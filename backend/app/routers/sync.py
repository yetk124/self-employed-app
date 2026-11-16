"""앱 화면 전체 데이터를 한 번에 내려주기 (로그인 직후·새로고침 때 프론트가 부름).

프론트는 이 데이터를 기기 저장소에 넣어 두고 화면을 그려요.
고친 내용은 각 API(PUT /menus/{id}, PUT /sales/{date} …)로 하나씩 올려요.
"""

from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import current_store
from ..models import Channel, DailyAdjustment, FixedCost, Ingredient, Menu, OffDay, Receipt, Sale, Store
from .receipts import _dto as receipt_dto
from .stores import channel_dto, settings_dto

router = APIRouter(tags=["동기화"])


@router.get("/state")
def full_state(st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """가게 하나의 설정·채널·식자재(가격 이력)·메뉴(판매가 이력)·판매·할인·휴무·고정비·영수증"""
    ings = db.scalars(select(Ingredient).where(Ingredient.store_id == st.id).options(selectinload(Ingredient.history)).order_by(Ingredient.id))
    menus = list(
        db.scalars(
            select(Menu)
            .where(Menu.store_id == st.id, Menu.archived.is_(False))
            .options(selectinload(Menu.history), selectinload(Menu.recipe))
            .order_by(Menu.id)
        )
    )
    live = {m.id for m in menus}
    sales: dict[str, dict[int, dict[int, int]]] = defaultdict(lambda: defaultdict(dict))
    for s in db.scalars(select(Sale).where(Sale.store_id == st.id)):
        if s.menu_id in live:
            sales[s.date.isoformat()][s.menu_id][s.channel_id] = s.qty
    receipts = db.scalars(
        select(Receipt)
        .where(Receipt.store_id == st.id)
        .options(selectinload(Receipt.items))
        .order_by(Receipt.purchased_at.desc(), Receipt.id.desc())
        .limit(100)
    )
    return {
        "store_id": st.id,
        "settings": settings_dto(st),
        "channels": [channel_dto(c) for c in db.scalars(select(Channel).where(Channel.store_id == st.id).order_by(Channel.id))],
        "ingredients": [
            {
                "id": g.id,
                "name": g.name,
                "unit": g.unit,
                "buy_price": g.buy_price,
                "buy_qty": g.buy_qty,
                "image_url": g.image_url,
                "history": [
                    {"from": h.valid_from.isoformat(), "buy_price": h.buy_price, "buy_qty": h.buy_qty} for h in sorted(g.history, key=lambda x: x.valid_from)
                ],
            }
            for g in ings
        ],
        "menus": [
            {
                "id": m.id,
                "name": m.name,
                "price": m.price,
                "image_url": m.image_url,
                "recipe": [{"ingredient_id": r.ingredient_id, "qty": r.qty} for r in m.recipe],
                "history": [{"from": h.valid_from.isoformat(), "price": h.price, "recipe": h.recipe} for h in sorted(m.history, key=lambda x: x.valid_from)],
            }
            for m in menus
        ],
        "sales": sales,
        "adjustments": [
            {"date": a.date.isoformat(), "discount": a.discount, "refund": a.refund}
            for a in db.scalars(select(DailyAdjustment).where(DailyAdjustment.store_id == st.id))
        ],
        "off_days": [{"date": o.date.isoformat(), "status": o.status} for o in db.scalars(select(OffDay).where(OffDay.store_id == st.id))],
        "fixed_costs": [
            {"id": f.id, "name": f.name, "amount": f.amount, "paid_on": f.paid_on.isoformat()}
            for f in db.scalars(select(FixedCost).where(FixedCost.store_id == st.id).order_by(FixedCost.paid_on))
        ],
        "receipts": [receipt_dto(r, items=True) for r in receipts],
    }
