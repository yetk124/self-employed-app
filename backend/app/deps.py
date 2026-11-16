"""라우터 공용 의존성: 로그인한 사용자 + 지금 가게 (X-Store-Id 헤더)."""

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import AuthUser, current_user
from .database import get_db
from .errors import ApiError
from .models import Store


def current_store(
    x_store_id: str | None = Header(default=None),
    user: AuthUser = Depends(current_user),
    db: Session = Depends(get_db),
) -> Store:
    """헤더로 가게를 고르고, 없으면 그 사장님의 첫 가게. 남의 가게면 403."""
    if x_store_id:
        try:
            sid = int(x_store_id)
        except ValueError as e:
            raise ApiError(400, "BAD_REQUEST", "X-Store-Id 는 숫자여야 해요.") from e
        st = db.get(Store, sid)
        if not st:
            raise ApiError(404, "NOT_FOUND", "가게를 찾을 수 없어요.")
        if st.owner_id != user.id:
            raise ApiError(403, "FORBIDDEN", "이 가게에 접근할 수 없어요.")
        return st
    st = db.scalars(select(Store).where(Store.owner_id == user.id).order_by(Store.id)).first()
    if not st:
        raise ApiError(404, "NO_STORE", "먼저 가게를 만들어 주세요. (POST /api/stores)")
    return st
