"""영수증: 사진 → OCR → LLM 구조화 → RAG 매칭(후보 3개) → (사장님 확인) → 저장"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import current_store
from ..errors import ApiError, bad, not_found
from ..models import Ingredient, Receipt, ReceiptItem, Store
from ..schemas import ParseText, ReceiptConfirm
from ..services import matcher, ocr
from ..services.pricing import D0, add_ing_history, recompute_sales
from ..services.receipt_ai import structure
from .ingredients import changed_menus, menu_costs

router = APIRouter(prefix="/receipts", tags=["영수증"])
MAX_IMAGE = 8 * 1024 * 1024


def _parse_result(db: Session, st: Store, raw: str, image_path: str | None) -> dict:
    parsed, how = structure(raw)
    cands = matcher.match(db, st.id, [i.name for i in parsed.items])
    db.commit()  # 새로 계산한 임베딩 저장
    today = date.today().isoformat()
    return {
        "image_path": image_path,
        "date": parsed.date if parsed.date and parsed.date <= today else today,
        "vendor": parsed.vendor,
        "total": parsed.total,
        "structured_by": how,  # llm | rule
        "items": [
            {"name": it.name, "qty": it.qty, "unit": it.unit, "amount": it.amount, "candidates": [c.__dict__ for c in cs], "auto_match": matcher.auto_pick(cs)}
            for it, cs in zip(parsed.items, cands, strict=True)
        ],
        "raw_text": raw,
    }


@router.post("/parse")
async def parse(request: Request, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """사진은 multipart(file), 글자 붙여넣기는 JSON {"text": ...}. 아직 저장은 안 해요."""
    ctype = request.headers.get("content-type", "")
    if ctype.startswith("multipart/form-data"):
        form = await request.form()
        f = form.get("file")
        if f is None or isinstance(f, str):
            raise bad("사진 파일(file)을 보내 주세요.")
        data = await f.read()
        if len(data) > MAX_IMAGE:
            raise bad("사진이 너무 커요. 8MB 이하로 보내 주세요.")
        raw = ocr.read_image(data)
        if not raw.strip():
            raise ApiError(502, "OCR_FAILED", "글자를 찾지 못했어요. 영수증을 네모 안에 맞춰 다시 찍어 주세요.")
        # 사진 저장은 Supabase Storage 로 (프론트가 직접 올리거나 여기서 올리도록 확장). 지금은 경로만 만들어 둠
        path = f"receipts/{st.id}/{date.today().isoformat()}/{uuid.uuid4().hex[:8]}.jpg"
        return _parse_result(db, st, raw, path)
    try:
        body = ParseText.model_validate(await request.json())
    except Exception as e:  # noqa: BLE001
        raise bad('사진(file) 또는 {"text": "..."} 를 보내 주세요.') from e
    return _parse_result(db, st, body.text, None)


@router.post("/confirm")
def confirm(b: ReceiptConfirm, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """확인한 결과 저장.
    update = 기존 식자재 단가 갱신 (영수증 날짜부터 적용) · new = 새 식자재 · skip = 저장 안 함
    지난 날짜 영수증이면 그 날짜 이후 판매 원가를 다시 계산해서 바뀐 이익(past_changed)을 알려 줘요.
    """
    if b.purchased_at > date.today():
        raise bad("구매일이 미래예요.")
    ings = {g.id: g for g in db.scalars(select(Ingredient).where(Ingredient.store_id == st.id).options(selectinload(Ingredient.history)))}
    before = menu_costs(db, st)
    rc = Receipt(
        store_id=st.id,
        purchased_at=b.purchased_at,
        vendor=b.vendor[:60],
        total=b.total or sum(i.amount for i in b.items if i.action != "skip"),
        image_path=b.image_path,
        raw_text=b.raw_text,
        ocr_source=b.ocr_source,
        fields_total=b.fields_total,
        fields_edited=b.fields_edited,
    )
    db.add(rc)
    db.flush()
    updated = added = 0
    for it in b.items:
        gid = None
        if it.action != "skip" and (it.qty <= 0 or it.amount <= 0):
            raise bad(f"'{it.name}'의 양과 금액을 확인해 주세요.")
        if it.action == "update":
            try:
                gid = int(it.ingredient_id) if it.ingredient_id is not None else None
            except ValueError:
                gid = None
            g = ings.get(gid) if gid else None
            if not g:
                raise bad(f"'{it.name}'을(를) 반영할 식자재를 찾을 수 없어요.")
            if g.unit != it.unit:
                raise ApiError(409, "UNIT_MISMATCH", f"단위가 달라요. {g.name}은(는) {g.unit} 기준이에요.")
            add_ing_history(g, b.purchased_at, it.amount, it.qty, "receipt", rc.id)
            matcher.learn(db, st.id, it.name, g.id)
            updated += 1
        elif it.action == "new":
            g = Ingredient(store_id=st.id, name=it.name.strip()[:40], unit=it.unit, buy_price=it.amount, buy_qty=it.qty)
            db.add(g)
            add_ing_history(g, D0, it.amount, it.qty, "receipt", rc.id)
            db.flush()
            gid = g.id
            added += 1
        rc.items.append(ReceiptItem(name=it.name[:60], qty=it.qty, unit=it.unit[:4], amount=it.amount, action=it.action, ingredient_id=gid))
    if not (updated + added):
        raise bad("반영할 품목이 없어요.")
    db.flush()
    changed = changed_menus(db, st, before)
    past = recompute_sales(db, st, b.purchased_at, None) if updated and b.purchased_at < date.today() else {}
    db.commit()
    return {"receipt_id": rc.id, "updated": updated, "added": added, "changed_menus": changed, "past_changed": past or None}


def _dto(r: Receipt, items: bool = False) -> dict:
    d = {
        "id": r.id,
        "purchased_at": r.purchased_at.isoformat(),
        "vendor": r.vendor,
        "total": r.total,
        "count": sum(1 for i in r.items if i.action != "skip"),
        "fields_total": r.fields_total,
        "fields_edited": r.fields_edited,
        "ocr_source": r.ocr_source,
    }
    if items:
        d["image_path"] = r.image_path
        d["items"] = [{"name": i.name, "qty": i.qty, "unit": i.unit, "amount": i.amount, "action": i.action, "ingredient_id": i.ingredient_id} for i in r.items]
    return d


@router.get("")
def list_receipts(st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """최근 영수증 + OCR 수정률(고친 칸 ÷ 읽은 칸) = OCR 정확도 지표"""
    rows = list(
        db.scalars(
            select(Receipt)
            .where(Receipt.store_id == st.id)
            .options(selectinload(Receipt.items))
            .order_by(Receipt.purchased_at.desc(), Receipt.id.desc())
            .limit(50)
        )
    )
    f = sum(r.fields_total for r in rows)
    e = sum(r.fields_edited for r in rows)
    return {"items": [_dto(r) for r in rows], "ocr_edit_rate": round(e / f, 3) if f else 0.0}


@router.get("/{rid}")
def get_receipt(rid: int, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    r = db.get(Receipt, rid, options=[selectinload(Receipt.items)])
    if not r or r.store_id != st.id:
        raise not_found("영수증")
    return _dto(r, items=True)
