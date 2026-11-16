"""가게 · 설정 · 판매 채널 · 업종 템플릿"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import AuthUser, current_user
from ..database import get_db
from ..deps import current_store
from ..errors import ApiError, bad, not_found
from ..models import Channel, Sale, Store
from ..schemas import ChannelIn, ChannelUpdate, SettingsUpdate, StoreCreate
from ..services import templates

router = APIRouter(tags=["가게·설정"])


def settings_dto(s: Store) -> dict:
    return {
        "store_id": s.id,
        "name": s.name,
        "biz_type": s.biz_type,
        "biz_sub": s.biz_sub,
        "open_time": s.open_time,
        "close_time": s.close_time,
        "daily_goal": s.daily_goal,
        "tables": s.tables,
        "off_weekdays": s.off_weekdays or [],
        "notify": s.notify,
    }


def channel_dto(c: Channel) -> dict:
    return {"id": c.id, "name": c.name, "fee_rate": c.fee_rate, "fixed_fee": c.fixed_fee}


@router.post("/stores", status_code=201)
def create_store(b: StoreCreate, user: AuthUser = Depends(current_user), db: Session = Depends(get_db)):
    """온보딩 마지막 '시작하기'. 템플릿을 고르면 메뉴·식자재 샘플도 같이 넣어요."""
    st = Store(owner_id=user.id, name=b.name.strip(), biz_type=b.biz_type, biz_sub=b.biz_sub, open_time=b.open_time, close_time=b.close_time, off_weekdays=[])
    db.add(st)
    db.flush()
    templates.default_channels(db, st)
    created = templates.apply(db, st, b.biz_type) if b.use_template else {"menus": 0, "ingredients": 0}
    db.commit()
    return {"id": st.id, "name": st.name, "biz_type": st.biz_type, "created": created}


@router.get("/stores")
def my_stores(user: AuthUser = Depends(current_user), db: Session = Depends(get_db)):
    """내 가게 목록 (가게 전환 화면용)"""
    rows = db.scalars(select(Store).where(Store.owner_id == user.id).order_by(Store.id))
    return {"items": [{"id": s.id, "name": s.name, "biz_type": s.biz_type} for s in rows]}


@router.get("/settings")
def get_settings_(st: Store = Depends(current_store)):
    return settings_dto(st)


@router.put("/settings")
def put_settings(b: SettingsUpdate, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """보낸 칸만 바꿔요. 마감 시각이 바뀌면 오늘 알림을 다시 보낼 수 있게 초기화."""
    data = b.model_dump(exclude_unset=True)
    if "off_weekdays" in data and any(w not in range(7) for w in data["off_weekdays"] or []):
        raise bad("휴무 요일은 0(일)~6(토)이어야 해요.")
    for k, v in data.items():
        setattr(st, k, v)
    if "close_time" in data:
        st.last_notified = None
    db.commit()
    return {"ok": True, **settings_dto(st)}


@router.get("/channels")
def list_channels(st: Store = Depends(current_store), db: Session = Depends(get_db)):
    return {"items": [channel_dto(c) for c in db.scalars(select(Channel).where(Channel.store_id == st.id).order_by(Channel.id))]}


@router.post("/channels", status_code=201)
def add_channel(b: ChannelIn, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    c = Channel(store_id=st.id, **b.model_dump())
    db.add(c)
    db.commit()
    return channel_dto(c)


def _channel(db: Session, st: Store, cid: int) -> Channel:
    c = db.get(Channel, cid)
    if not c or c.store_id != st.id:
        raise not_found("채널")
    return c


@router.put("/channels/{cid}")
def put_channel(cid: int, b: ChannelUpdate, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """수수료를 바꾸면 앞으로 저장하는 판매부터 적용돼요 (지난 판매 스냅샷은 그대로)."""
    c = _channel(db, st, cid)
    for k, v in b.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    return {"ok": True, **channel_dto(c)}


@router.delete("/channels/{cid}")
def del_channel(cid: int, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    c = _channel(db, st, cid)
    n = db.scalar(select(func.count()).select_from(Channel).where(Channel.store_id == st.id))
    if n <= 1:
        raise bad("채널이 1개만 남으면 지울 수 없어요.")
    if db.scalars(select(Sale.id).where(Sale.channel_id == cid).limit(1)).first():
        raise ApiError(409, "IN_USE", "이 채널로 저장한 판매가 있어요. 판매 기록을 먼저 지워 주세요.")
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.get("/templates")
def list_templates():
    """업종 목록 (온보딩 화면용, 로그인 없이)"""
    return {"items": templates.load()["biz"]}


@router.get("/templates/{biz}")
def get_template(biz: str):
    t = templates.get(biz)
    if not t:
        raise not_found("업종 템플릿")
    return {"biz": biz, **t}
