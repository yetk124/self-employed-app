"""마감 알림 (Web Push). 앱이 꺼져 있어도 영업 종료 시각에 '오늘 판매 입력' 알림을 보내요.

Render cron 이 5분마다 POST /api/internal/cron/close-reminder 를 부르면,
마감 시각이 지났고 오늘 판매를 안 넣은 가게에 알림을 보내요.
보내려면 pywebpush 설치 + VAPID 키가 필요해요 (README 참고).
"""

import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import PushSubscription, Sale, Store
from .stats import StoreData

log = logging.getLogger(__name__)
KST = timezone(timedelta(hours=9))


def _send(sub: PushSubscription, payload: dict) -> bool:
    s = get_settings()
    if not s.vapid_private_key:
        return False
    try:
        from pywebpush import webpush  # 필요할 때만 불러옴 (requirements 선택 항목)
    except ImportError:
        log.warning("pywebpush 가 설치되지 않았어요.")
        return False
    try:
        webpush(
            subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=s.vapid_private_key,
            vapid_claims={"sub": s.vapid_subject},
        )
        return True
    except Exception as e:  # noqa: BLE001
        log.warning("푸시 실패: %s", e)
        return False


def close_reminders(db: Session, now: datetime | None = None) -> int:
    now = now or datetime.now(KST)
    today, hm = now.date(), now.strftime("%H:%M")
    sent = 0
    for st in db.scalars(select(Store).where(Store.notify.is_(True))):
        if st.last_notified == today or hm < st.close_time:
            continue
        h, m = map(int, st.close_time.split(":"))
        if (now.hour * 60 + now.minute) - (h * 60 + m) > 90:  # 마감 후 90분이 지나면 안 보냄
            continue
        if db.scalars(select(Sale.id).where(Sale.store_id == st.id, Sale.date == today).limit(1)).first():
            continue
        if StoreData(db, st, today, today).is_off(today):
            continue
        subs = db.scalars(select(PushSubscription).where(PushSubscription.store_id == st.id)).all()
        ok = [_send(s, {"title": "domain", "body": "오늘 판매를 1분 만에 입력하고 이익을 확인하세요.", "url": "/app/"}) for s in subs]
        if any(ok):
            sent += 1
        st.last_notified = today
    db.commit()
    return sent
