"""식자재와 단가. 단가가 바뀌면 가격 이력에 날짜와 함께 쌓여요."""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import current_store
from ..errors import ApiError, not_found
from ..models import Ingredient, Menu, RecipeItem, Store
from ..schemas import IngredientIn, IngredientUpdate
from ..services.pricing import D0, PriceBook, add_ing_history, recompute_sales

router = APIRouter(prefix="/ingredients", tags=["식자재"])


def dto(g: Ingredient, used: int = 0) -> dict:
    return {
        "id": g.id,
        "name": g.name,
        "unit": g.unit,
        "buy_price": g.buy_price,
        "buy_qty": g.buy_qty,
        "unit_price": round(g.buy_price / g.buy_qty, 4) if g.buy_qty else 0,
        "image_url": g.image_url,
        "used_in": used,
    }


def _get(db: Session, st: Store, iid: int) -> Ingredient:
    g = db.get(Ingredient, iid, options=[selectinload(Ingredient.history)])
    if not g or g.store_id != st.id:
        raise not_found("식자재")
    return g


def changed_menus(db: Session, st: Store, before: dict[int, float]) -> list[dict]:
    """원가가 바뀐 메뉴 (오늘 기준)"""
    db.flush()
    book = PriceBook(db, st)
    out = []
    for m in book.menus.values():
        a = book.menu_cost_now(m)
        if m.id in before and round(a) != round(before[m.id]):
            out.append({"id": m.id, "name": m.name, "cost_before": round(before[m.id]), "cost_after": round(a)})
    return out


def menu_costs(db: Session, st: Store) -> dict[int, float]:
    book = PriceBook(db, st)
    return {m.id: book.menu_cost_now(m) for m in book.menus.values()}


@router.get("")
def list_ingredients(st: Store = Depends(current_store), db: Session = Depends(get_db)):
    used: dict[int, int] = {}
    for r in db.scalars(select(RecipeItem).join(Menu).where(Menu.store_id == st.id)):
        used[r.ingredient_id] = used.get(r.ingredient_id, 0) + 1
    rows = db.scalars(select(Ingredient).where(Ingredient.store_id == st.id).order_by(Ingredient.id))
    return {"items": [dto(g, used.get(g.id, 0)) for g in rows]}


@router.post("", status_code=201)
def add_ingredient(b: IngredientIn, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    g = Ingredient(store_id=st.id, **b.model_dump())
    db.add(g)
    add_ing_history(g, D0, b.buy_price, b.buy_qty, "manual")
    db.commit()
    return dto(g)


@router.put("/{iid}")
def put_ingredient(iid: int, b: IngredientUpdate, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """가격이 바뀌면 valid_from(기본 오늘)부터 적용되는 이력을 추가. 지난 장부는 그대로예요."""
    g = _get(db, st, iid)
    before = menu_costs(db, st)
    data = b.model_dump(exclude_unset=True)
    vf = data.pop("valid_from", None) or date.today()
    price, qty = data.pop("buy_price", g.buy_price), data.pop("buy_qty", g.buy_qty)
    for k, v in data.items():
        setattr(g, k, v)
    hist_same = any(h.valid_from == vf and h.buy_price == price and h.buy_qty == qty for h in g.history)
    past = {}
    if not hist_same and (price != g.buy_price or qty != g.buy_qty or "buy_price" in b.model_fields_set or "buy_qty" in b.model_fields_set):
        add_ing_history(g, vf, price, qty, "manual")
        if vf < date.today():
            db.flush()
            past = recompute_sales(db, st, vf, None)
    changed = changed_menus(db, st, before)
    db.commit()
    return {**dto(g), "changed_menus": changed, "past_changed": past or None}


@router.delete("/{iid}")
def del_ingredient(iid: int, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    g = _get(db, st, iid)
    if db.scalars(select(RecipeItem.id).where(RecipeItem.ingredient_id == iid).limit(1)).first():
        raise ApiError(409, "IN_USE", "메뉴 레시피에서 먼저 빼 주세요.")
    db.delete(g)
    db.commit()
    return {"ok": True}


@router.get("/{iid}/price-history")
def price_history(iid: int, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    g = _get(db, st, iid)
    return {
        "items": [
            {
                "valid_from": h.valid_from.isoformat(),
                "buy_price": h.buy_price,
                "buy_qty": h.buy_qty,
                "unit_price": round(h.buy_price / h.buy_qty, 4),
                "source": h.source,
                "receipt_id": h.receipt_id,
            }
            for h in g.history
        ]
    }
