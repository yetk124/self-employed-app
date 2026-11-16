"""로그인 확인. 프론트가 Supabase 로 로그인하고 받은 토큰(JWT)을 Authorization 헤더로 보내요.

AUTH_MODE=dev       : 토큰 없이 'dev-user' 로 통과 (Bearer dev:<아이디> 로 다른 사용자 흉내 가능)
AUTH_MODE=supabase  : SUPABASE_JWT_SECRET(HS256) 또는 SUPABASE_URL 의 JWKS(비대칭 키)로 검사
"""

from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Header

from .config import get_settings
from .errors import ApiError


@dataclass
class AuthUser:
    id: str
    email: str = ""


@lru_cache
def _jwks() -> jwt.PyJWKClient:
    url = get_settings().supabase_url.rstrip("/") + "/auth/v1/.well-known/jwks.json"
    return jwt.PyJWKClient(url, cache_keys=True)


def _verify(token: str) -> dict:
    s = get_settings()
    try:
        if s.supabase_jwt_secret:
            return jwt.decode(token, s.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated")
        key = _jwks().get_signing_key_from_jwt(token).key
        return jwt.decode(token, key, algorithms=["ES256", "RS256"], audience="authenticated")
    except jwt.ExpiredSignatureError as e:
        raise ApiError(401, "UNAUTHORIZED", "로그인이 만료됐어요. 다시 로그인해 주세요.") from e
    except Exception as e:  # noqa: BLE001
        raise ApiError(401, "UNAUTHORIZED", "로그인 정보를 확인할 수 없어요.") from e


def current_user(authorization: str | None = Header(default=None)) -> AuthUser:
    s = get_settings()
    token = authorization.split(" ", 1)[1].strip() if authorization and authorization.lower().startswith("bearer ") else ""
    if s.auth_mode == "dev":
        if token.startswith("dev:"):
            return AuthUser(id=token[4:] or "dev-user")
        return AuthUser(id="dev-user", email="dev@example.com")
    if not token:
        raise ApiError(401, "UNAUTHORIZED", "로그인이 필요해요.")
    claims = _verify(token)
    return AuthUser(id=str(claims.get("sub")), email=str(claims.get("email") or ""))
