"""계정 · 알림 · 사용 기록 · 비회원 기록 옮기기 · 탈퇴 (로그인 자체는 프론트 → Supabase Auth)"""

from datetime import date

from fastapi import APIRouter, Depends, Header
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..auth import AuthUser, current_user
from ..config import get_settings
from ..database import get_db
from ..errors import ApiError
from ..models import Channel, DailyAdjustment, Event, FixedCost, Ingredient, Menu, MenuPriceHistory, OffDay, PushSubscription, RecipeItem, Sale, Store
from ..schemas import EventIn, ImportPayload, PushSub
from ..services import templates
from ..services.pricing import D0, PriceBook, add_ing_history
from ..services.push import close_reminders

router = APIRouter(tags=["계정·알림"])


@router.post("/import", status_code=201)
def import_local(b: ImportPayload, user: AuthUser = Depends(current_user), db: Session = Depends(get_db)):
    """'나중에 할게요'로 기기에만 저장한 기록을 가입 직후 서버로 한 번에 옮겨요.
    프론트의 문자열 key 를 받아서 서버의 숫자 id 로 바꿔 연결해요.
    """
    s = b.store
    st = Store(
        owner_id=user.id,
        name=s.name,
        biz_type=s.biz_type,
        biz_sub=s.biz_sub,
        open_time=s.open_time,
        close_time=s.close_time,
        daily_goal=b.daily_goal,
        tables=b.tables,
        off_weekdays=b.off_weekdays,
    )
    db.add(st)
    db.flush()
    ch: dict[str, int] = {}
    if b.channels:
        for c in b.channels:
            row = Channel(store_id=st.id, name=c.name, fee_rate=c.fee_rate, fixed_fee=c.fixed_fee)
            db.add(row)
            db.flush()
            ch[c.key] = row.id
    else:
        templates.default_channels(db, st)
    ing: dict[str, int] = {}
    for g in b.ingredients:
        row = Ingredient(store_id=st.id, name=g.name, unit=g.unit, buy_price=g.buy_price, buy_qty=g.buy_qty)
        db.add(row)
        hist = g.history or [{"from": D0.isoformat(), "buy_price": g.buy_price, "buy_qty": g.buy_qty}]
        for h in hist:
            add_ing_history(row, date.fromisoformat(h["from"]), int(h["buy_price"]), float(h["buy_qty"]), "import")
        db.flush()
        ing[g.key] = row.id
    menu: dict[str, int] = {}
    for m in b.menus:
        row = Menu(store_id=st.id, name=m.name, price=m.price)
        row.recipe = [RecipeItem(ingredient_id=ing[r["ingredient"]], qty=float(r["qty"])) for r in m.recipe if r.get("ingredient") in ing]
        db.add(row)
        db.flush()
        hist = m.history or [{"from": D0.isoformat(), "price": m.price, "recipe": m.recipe}]
        for h in hist:
            rec = [{"ingredient_id": ing[r["ingredient"]], "qty": float(r["qty"])} for r in h.get("recipe", []) if r.get("ingredient") in ing]
            row.history.append(MenuPriceHistory(valid_from=date.fromisoformat(h["from"]), price=int(h["price"]), recipe=rec))
        menu[m.key] = row.id
    db.flush()
    book = PriceBook(db, st)
    n_days: set[date] = set()
    for sl in b.sales:
        if sl.menu not in menu or sl.channel not in ch or sl.qty <= 0:
            continue
        price, cost, fee = book.snapshot(menu[sl.menu], ch[sl.channel], sl.date)
        db.add(Sale(store_id=st.id, date=sl.date, menu_id=menu[sl.menu], channel_id=ch[sl.channel], qty=sl.qty, unit_price=price, unit_cost=cost, fee=fee))
        n_days.add(sl.date)
    for a in b.adjustments:
        db.add(DailyAdjustment(store_id=st.id, date=date.fromisoformat(a["date"]), discount=int(a.get("discount", 0)), refund=int(a.get("refund", 0))))
    for o in b.off_days:
        db.add(OffDay(store_id=st.id, date=date.fromisoformat(o["date"]), status=o["status"]))
    for f in b.fixed_costs:
        db.add(FixedCost(store_id=st.id, name=f.name, amount=f.amount, paid_on=f.paid_on))
    db.commit()
    return {"store_id": st.id, "imported": {"menus": len(menu), "ingredients": len(ing), "sales_days": len(n_days)}}


@router.post("/push/subscribe")
def push_subscribe(b: PushSub, x_store_id: str | None = Header(default=None), user: AuthUser = Depends(current_user), db: Session = Depends(get_db)):
    """브라우저가 준 푸시 구독 정보를 저장. 서버 스케줄러가 마감 시각에 알림을 보내요."""
    sid = int(x_store_id) if x_store_id and x_store_id.isdigit() else None
    row = db.scalars(select(PushSubscription).where(PushSubscription.endpoint == b.endpoint)).first()
    if not row:
        row = PushSubscription(endpoint=b.endpoint, user_id=user.id, p256dh="", auth="")
        db.add(row)
    row.user_id, row.store_id, row.p256dh, row.auth = user.id, sid, b.keys.get("p256dh", ""), b.keys.get("auth", "")
    db.commit()
    return {"ok": True}


@router.delete("/push/subscribe")
def push_unsubscribe(user: AuthUser = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(PushSubscription).where(PushSubscription.user_id == user.id))
    db.commit()
    return {"ok": True}


@router.post("/events")
def log_event(b: EventIn, x_store_id: str | None = Header(default=None), user: AuthUser = Depends(current_user), db: Session = Depends(get_db)):
    """사용 기록 (가입 24시간 안 첫 마진 확인률, 4주 유지율 같은 성공 지표용)"""
    db.add(Event(user_id=user.id, store_id=int(x_store_id) if x_store_id and x_store_id.isdigit() else None, name=b.name, props=b.props))
    db.commit()
    return {"ok": True}


@router.delete("/me")
def delete_me(user: AuthUser = Depends(current_user), db: Session = Depends(get_db)):
    """계정의 모든 가게 데이터를 지워요 (되돌릴 수 없음). Supabase 계정 자체 삭제는 서비스 키로 따로 처리."""
    for st in db.scalars(select(Store).where(Store.owner_id == user.id)).all():
        db.delete(st)
    db.execute(delete(PushSubscription).where(PushSubscription.user_id == user.id))
    db.execute(delete(Event).where(Event.user_id == user.id))
    db.commit()
    return {"ok": True}


@router.post("/internal/cron/close-reminder", include_in_schema=False)
def cron_close_reminder(x_cron_secret: str | None = Header(default=None), db: Session = Depends(get_db)):
    """Render cron 이 5분마다 부름. 마감 시각이 지났는데 오늘 판매가 없는 가게에 푸시."""
    secret = get_settings().cron_secret
    if not secret or x_cron_secret != secret:
        raise ApiError(403, "FORBIDDEN", "권한이 없어요.")
    return {"sent": close_reminders(db)}
