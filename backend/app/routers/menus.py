"""메뉴·레시피와 앱의 핵심인 '메뉴별 실제 마진'"""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import current_store
from ..errors import bad, not_found
from ..models import Channel, Ingredient, Menu, RecipeItem, Sale, Store
from ..schemas import MenuIn, MenuUpdate, RecipeIn
from ..services.pricing import D0, PriceBook, add_menu_history, resnapshot_sales, set_menu_version

router = APIRouter(tags=["메뉴·마진"])
WARN = 40.0  # 원가율 경고 기준 %


def _recipe(db: Session, st: Store, items: list[RecipeIn]) -> list[RecipeItem]:
    ids = {g.id for g in db.scalars(select(Ingredient).where(Ingredient.store_id == st.id))}
    if any(r.ingredient_id not in ids for r in items):
        raise bad("레시피에 이 가게에 없는 식자재가 있어요.")
    return [RecipeItem(ingredient_id=r.ingredient_id, qty=r.qty) for r in items]


def dto(m: Menu, book: PriceBook) -> dict:
    cost = book.menu_cost_now(m)
    return {
        "id": m.id,
        "name": m.name,
        "price": m.price,
        "image_url": m.image_url,
        "recipe": [
            {
                "ingredient_id": r.ingredient_id,
                "name": book.ings[r.ingredient_id].name if r.ingredient_id in book.ings else "?",
                "qty": r.qty,
                "unit": book.ings[r.ingredient_id].unit if r.ingredient_id in book.ings else "",
            }
            for r in m.recipe
        ],
        "cost": round(cost),
        "cost_rate": round(cost / m.price * 100, 1) if m.price else 0,
    }


def _get(db: Session, st: Store, mid: int) -> Menu:
    m = db.get(Menu, mid, options=[selectinload(Menu.recipe), selectinload(Menu.history)])
    if not m or m.store_id != st.id or m.archived:
        raise not_found("메뉴")
    return m


@router.get("/menus")
def list_menus(st: Store = Depends(current_store), db: Session = Depends(get_db)):
    book = PriceBook(db, st)
    return {"items": [dto(m, book) for m in sorted(book.menus.values(), key=lambda x: x.id) if not m.archived]}


@router.post("/menus", status_code=201)
def add_menu(b: MenuIn, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    m = Menu(store_id=st.id, name=b.name.strip(), price=b.price, image_url=b.image_url)
    m.recipe = _recipe(db, st, b.recipe)
    db.add(m)
    db.flush()
    add_menu_history(m, D0)
    db.commit()
    return dto(m, PriceBook(db, st))


@router.put("/menus/{mid}")
def put_menu(mid: int, b: MenuUpdate, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """판매가·레시피가 바뀌면 valid_from(기본 오늘)부터 적용되는 이력을 남겨요.
    지난 날짜부터 적용하면 그날 이후 판매의 스냅샷을 다시 계산해요."""
    m = _get(db, st, mid)
    data = b.model_dump(exclude_unset=True)
    vf = data.get("valid_from") or date.today()
    if "name" in data:
        m.name = data["name"].strip()
    if "image_url" in data:
        m.image_url = data["image_url"]
    if "price" not in data and b.recipe is None:
        db.commit()
        return dto(m, PriceBook(db, st))
    book = PriceBook(db, st)
    cur_price, cur_recipe = book.menu_version(m.id, vf)
    price = data.get("price", cur_price)
    recipe = [{"ingredient_id": r.ingredient_id, "qty": r.qty} for r in _recipe(db, st, b.recipe)] if b.recipe is not None else list(cur_recipe)
    if (price, sorted((r["ingredient_id"], r["qty"]) for r in recipe)) != (cur_price, sorted((r["ingredient_id"], r["qty"]) for r in cur_recipe)):
        set_menu_version(m, vf, price, recipe)
        db.flush()
        # 지금(오늘 기준) 판매가·레시피를 이력에 맞춤
        p_now, r_now = PriceBook(db, st).menu_version(m.id, date.today())
        m.price = p_now
        m.recipe = [RecipeItem(ingredient_id=r["ingredient_id"], qty=float(r["qty"])) for r in r_now]
        if vf < date.today():
            resnapshot_sales(db, st, vf, m.id)
    db.commit()
    return dto(m, PriceBook(db, st))


@router.delete("/menus/{mid}")
def del_menu(mid: int, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """판매 기록이 있으면 숨기기만 하고(archived), 없으면 지워요. 지난 장부가 사라지지 않게."""
    m = _get(db, st, mid)
    if db.scalars(select(Sale.id).where(Sale.menu_id == mid).limit(1)).first():
        m.archived = True
    else:
        db.delete(m)
    db.commit()
    return {"ok": True}


@router.get("/margin")
def margin(st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """메뉴마다 원가·원가율, 채널별로 1개 팔면 남는 돈. 원가율 40% 이상이면 warn"""
    book = PriceBook(db, st)
    chans = list(db.scalars(select(Channel).where(Channel.store_id == st.id).order_by(Channel.id)))
    items = []
    for m in sorted(book.menus.values(), key=lambda x: x.id):
        if m.archived:
            continue
        cost = book.menu_cost_now(m)
        rate = cost / m.price * 100 if m.price else 0
        items.append(
            {
                "menu_id": m.id,
                "name": m.name,
                "price": m.price,
                "cost": round(cost),
                "cost_rate": round(rate, 1),
                "warn": rate >= WARN,
                "margin_by_channel": [
                    {"channel_id": c.id, "name": c.name, "margin": round(m.price - cost - m.price * c.fee_rate / 100 - c.fixed_fee)} for c in chans
                ],
            }
        )
    return {"items": items, "warn_count": sum(1 for i in items if i["warn"])}
