"""업종 템플릿 (프론트 data/templates.ts 와 같은 내용, app/data/templates.json)."""

import json
from functools import lru_cache
from pathlib import Path

from sqlalchemy.orm import Session

from ..models import Channel, Ingredient, Menu, RecipeItem, Store
from .pricing import D0, add_ing_history, add_menu_history

DATA = Path(__file__).resolve().parent.parent / "data"


@lru_cache
def load() -> dict:
    return json.loads((DATA / "templates.json").read_text(encoding="utf-8"))


def get(biz: str) -> dict | None:
    return load()["templates"].get(biz)


def default_channels(db: Session, store: Store) -> None:
    for c in load()["channels"]:
        db.add(Channel(store_id=store.id, name=c["name"], fee_rate=c["fee_rate"], fixed_fee=c["fixed_fee"]))


def apply(db: Session, store: Store, biz: str) -> dict:
    """템플릿 메뉴·식자재를 가게에 넣음. 넣은 개수를 돌려줌"""
    t = get(biz)
    if not t:
        return {"menus": 0, "ingredients": 0}
    ids: dict[str, int] = {}
    for g in t["ingredients"]:
        ing = Ingredient(store_id=store.id, name=g["name"], unit=g["unit"], buy_price=g["buy_price"], buy_qty=g["buy_qty"])
        db.add(ing)
        add_ing_history(ing, D0, g["buy_price"], g["buy_qty"], "import")
        db.flush()
        ids[g["key"]] = ing.id
    for m in t["menus"]:
        menu = Menu(store_id=store.id, name=m["name"], price=m["price"])
        menu.recipe = [RecipeItem(ingredient_id=ids[r["ingredient"]], qty=r["qty"]) for r in m["recipe"] if r["ingredient"] in ids]
        db.add(menu)
        db.flush()
        add_menu_history(menu, D0)
    return {"menus": len(t["menus"]), "ingredients": len(t["ingredients"])}
