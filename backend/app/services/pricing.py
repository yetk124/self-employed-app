"""가격 이력과 판매 스냅샷.

- 식자재 단가·메뉴 판매가·레시피는 valid_from(적용 시작일)과 함께 이력으로 쌓여요.
- 판매를 저장할 때 그날 유효한 값으로 unit_price·unit_cost·fee 를 계산해서 sales 에 같이 저장해요.
- 지난 날짜 영수증이 들어오면 recompute_sales 로 그 날짜 이후 판매 원가만 다시 계산해요.
"""

from collections import defaultdict
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Channel, Ingredient, IngredientPriceHistory, Menu, MenuPriceHistory, Sale, Store

D0 = date(2000, 1, 1)


def _at(rows: list, d: date):
    """valid_from <= d 중 가장 최근 것. 없으면 가장 오래된 것."""
    best = None
    for r in rows:
        if r.valid_from <= d and (best is None or r.valid_from >= best.valid_from):
            best = r
    return best or (rows[0] if rows else None)


class PriceBook:
    """가게 하나의 단가·메뉴·채널을 한 번에 읽어 두고 날짜별로 계산 (DB를 여러 번 안 부르게)."""

    def __init__(self, db: Session, store: Store):
        self.store = store
        self.ings: dict[int, Ingredient] = {
            g.id: g for g in db.scalars(select(Ingredient).where(Ingredient.store_id == store.id).options(selectinload(Ingredient.history)))
        }
        self.menus: dict[int, Menu] = {
            m.id: m for m in db.scalars(select(Menu).where(Menu.store_id == store.id).options(selectinload(Menu.history), selectinload(Menu.recipe)))
        }
        self.channels: dict[int, Channel] = {c.id: c for c in db.scalars(select(Channel).where(Channel.store_id == store.id))}
        # 미리보기용: 식자재 id → 덧붙일 가상 이력 [(valid_from, price, qty)]
        self.extra: dict[int, list[tuple[date, int, float]]] = defaultdict(list)

    def unit_price_at(self, ing_id: int, d: date, with_extra: bool = False) -> float:
        g = self.ings.get(ing_id)
        if not g:
            return 0.0
        rows = list(g.history)
        if with_extra and ing_id in self.extra:
            fake = [type("H", (), {"valid_from": vf, "buy_price": p, "buy_qty": q}) for vf, p, q in self.extra[ing_id]]
            rows = [r for r in rows if r.valid_from not in {f.valid_from for f in fake}] + fake
        h = _at(rows, d)
        price, qty = (h.buy_price, h.buy_qty) if h else (g.buy_price, g.buy_qty)
        return price / qty if qty else 0.0

    def menu_version(self, menu_id: int, d: date) -> tuple[int, list[dict]]:
        m = self.menus[menu_id]
        h = _at(list(m.history), d)
        if h:
            return h.price, h.recipe
        return m.price, [{"ingredient_id": r.ingredient_id, "qty": r.qty} for r in m.recipe]

    def menu_cost_at(self, menu_id: int, d: date, with_extra: bool = False) -> float:
        _, recipe = self.menu_version(menu_id, d)
        return sum(self.unit_price_at(r["ingredient_id"], d, with_extra) * float(r["qty"]) for r in recipe)

    def menu_cost_now(self, m: Menu) -> float:
        return sum(self.unit_price_at(r.ingredient_id, date.today()) * r.qty for r in m.recipe)

    def snapshot(self, menu_id: int, channel_id: int, d: date) -> tuple[int, float, float]:
        """(개당 판매가, 개당 원가, 개당 수수료)"""
        price, _ = self.menu_version(menu_id, d)
        ch = self.channels.get(channel_id)
        fee = (price * (ch.fee_rate if ch else 0) / 100) + (ch.fixed_fee if ch else 0)
        return price, self.menu_cost_at(menu_id, d), fee


def add_ing_history(g: Ingredient, valid_from: date, price: int, qty: float, source: str = "manual", receipt_id: int | None = None) -> None:
    """같은 날 이력이 있으면 덮어쓰고, 없으면 추가. 그다음 지금 단가를 오늘 기준으로 맞춤."""
    for h in g.history:
        if h.valid_from == valid_from:
            h.buy_price, h.buy_qty, h.source, h.receipt_id = price, qty, source, receipt_id
            break
    else:
        g.history.append(IngredientPriceHistory(valid_from=valid_from, buy_price=price, buy_qty=qty, source=source, receipt_id=receipt_id))
    sync_current(g)


def sync_current(g: Ingredient) -> None:
    h = _at(sorted(g.history, key=lambda x: x.valid_from), date.today())
    if h:
        g.buy_price, g.buy_qty = h.buy_price, h.buy_qty


def add_menu_history(m: Menu, valid_from: date) -> None:
    """지금 판매가·레시피를 valid_from 부터 적용되는 이력으로 남김"""
    recipe = [{"ingredient_id": r.ingredient_id, "qty": r.qty} for r in m.recipe]
    set_menu_version(m, valid_from, m.price, recipe)


def set_menu_version(m: Menu, valid_from: date, price: int, recipe: list[dict]) -> None:
    """valid_from 부터 적용되는 판매가·레시피 이력을 넣거나(같은 날이면 덮어씀) 바꿔요."""
    for h in m.history:
        if h.valid_from == valid_from:
            h.price, h.recipe = price, recipe
            return
    m.history.append(MenuPriceHistory(valid_from=valid_from, price=price, recipe=recipe))


def resnapshot_sales(db: Session, store: Store, start: date, menu_id: int | None = None) -> int:
    """start 이후 판매의 판매가·원가·수수료 스냅샷을 지금 이력으로 다시 계산. 바뀐 줄 수를 돌려줌."""
    db.flush()
    book = PriceBook(db, store)
    q = select(Sale).where(Sale.store_id == store.id, Sale.date >= start)
    if menu_id is not None:
        q = q.where(Sale.menu_id == menu_id)
    n = 0
    for s in db.scalars(q):
        if s.menu_id not in book.menus:
            continue
        s.unit_price, s.unit_cost, s.fee = book.snapshot(s.menu_id, s.channel_id, s.date)
        n += 1
    return n


def recompute_sales(db: Session, store: Store, start: date, end: date | None = None) -> dict:
    """start ~ end 판매의 unit_cost 를 지금 이력으로 다시 계산. 바뀐 이익 합계를 돌려줌."""
    book = PriceBook(db, store)
    q = select(Sale).where(Sale.store_id == store.id, Sale.date >= start)
    if end:
        q = q.where(Sale.date <= end)
    by_day: dict[date, float] = defaultdict(float)
    for s in db.scalars(q):
        new = book.menu_cost_at(s.menu_id, s.date)
        diff = (s.unit_cost - new) * s.qty  # 원가가 오르면 이익은 줄어듦 (음수)
        if round(diff):
            by_day[s.date] += diff
        s.unit_cost = new
    days = sorted(d for d, v in by_day.items() if round(v))
    if not days:
        return {}
    return {"from": days[0].isoformat(), "to": days[-1].isoformat(), "days": len(days), "profit_delta": round(sum(by_day.values()))}
