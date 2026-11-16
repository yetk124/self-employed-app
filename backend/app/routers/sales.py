"""하루 판매 입력 · 할인·환불 · 휴무일 · 장부"""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_store
from ..errors import bad
from ..models import DailyAdjustment, OffDay, Sale, Store
from ..schemas import AdjustPut, OffDayPut, SalesPut
from ..services import stats
from ..services.pricing import PriceBook

router = APIRouter(tags=["판매·장부"])


def _day_dto(db: Session, st: Store, d: date) -> dict:
    rows = list(db.scalars(select(Sale).where(Sale.store_id == st.id, Sale.date == d).order_by(Sale.menu_id, Sale.channel_id)))
    adj = db.scalars(select(DailyAdjustment).where(DailyAdjustment.store_id == st.id, DailyAdjustment.date == d)).first()
    disc, ref = (adj.discount, adj.refund) if adj else (0, 0)
    gross = sum(s.unit_price * s.qty for s in rows)
    cost = sum(s.unit_cost * s.qty for s in rows)
    fee = sum(s.fee * s.qty for s in rows)
    rev = gross - disc - ref
    return {
        "date": d.isoformat(),
        "items": [
            {
                "menu_id": s.menu_id,
                "channel_id": s.channel_id,
                "qty": s.qty,
                "unit_price": s.unit_price,
                "unit_cost": round(s.unit_cost, 1),
                "fee": round(s.fee, 1),
            }
            for s in rows
        ],
        "discount": disc,
        "refund": ref,
        "totals": {
            "gross": round(gross),
            "revenue": round(rev),
            "cost": round(cost),
            "fee": round(fee),
            "profit": round(rev - cost - fee),
            "count": sum(s.qty for s in rows),
        },
    }


def _set_adj(db: Session, st: Store, d: date, disc: int, ref: int) -> None:
    row = db.scalars(select(DailyAdjustment).where(DailyAdjustment.store_id == st.id, DailyAdjustment.date == d)).first()
    if not disc and not ref:
        if row:
            db.delete(row)
        return
    if row:
        row.discount, row.refund = disc, ref
    else:
        db.add(DailyAdjustment(store_id=st.id, date=d, discount=disc, refund=ref))


@router.get("/sales/{d}")
def get_sales(d: date, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """그날 판매. 입력한 적 없으면 items 가 빈 배열"""
    return _day_dto(db, st, d)


@router.put("/sales/{d}")
def put_sales(d: date, b: SalesPut, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """그날 판매를 통째로 덮어써요. 줄마다 그날 유효한 판매가·원가·수수료를 스냅샷으로 저장."""
    if d > date.today():
        raise bad("미래 날짜에는 판매를 입력할 수 없어요.")
    book = PriceBook(db, st)
    for it in b.items:
        if it.menu_id not in book.menus or it.channel_id not in book.channels:
            raise bad("이 가게에 없는 메뉴나 채널이 있어요.")
    db.execute(delete(Sale).where(Sale.store_id == st.id, Sale.date == d))
    merged: dict[tuple[int, int], int] = {}
    for it in b.items:
        merged[(it.menu_id, it.channel_id)] = merged.get((it.menu_id, it.channel_id), 0) + it.qty
    for (mid, cid), qty in merged.items():
        if qty <= 0:
            continue
        price, cost, fee = book.snapshot(mid, cid, d)
        db.add(Sale(store_id=st.id, date=d, menu_id=mid, channel_id=cid, qty=qty, unit_price=price, unit_cost=cost, fee=fee))
    _set_adj(db, st, d, b.discount, b.refund)
    db.commit()
    return _day_dto(db, st, d)


@router.put("/adjustments/{d}")
def put_adjustments(d: date, b: AdjustPut, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    _set_adj(db, st, d, b.discount, b.refund)
    db.commit()
    return {"ok": True}


@router.put("/off-days/{d}")
def put_off_day(d: date, b: OffDayPut, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """off = 쉬는 날, open = 정기 휴무 요일인데 영업, null = 원래대로"""
    row = db.scalars(select(OffDay).where(OffDay.store_id == st.id, OffDay.date == d)).first()
    if b.status is None:
        if row:
            db.delete(row)
    elif row:
        row.status = b.status
    else:
        db.add(OffDay(store_id=st.id, date=d, status=b.status))
    db.commit()
    return {"ok": True}


@router.delete("/sales")
def clear_sales(st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """이 가게의 판매 기록을 모두 지워요 (되돌릴 수 없음)"""
    db.execute(delete(Sale).where(Sale.store_id == st.id))
    db.execute(delete(DailyAdjustment).where(DailyAdjustment.store_id == st.id))
    db.commit()
    return {"ok": True}


@router.get("/ledger")
def ledger(month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"), st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """달력(날짜별 매출·지출·휴무) + 거래 내역 + 이번 달 예상 매출 + 요일별 평균"""
    return stats.ledger(db, st, month)
