"""DB 연결. 로컬은 SQLite, 배포는 Supabase(PostgreSQL)."""

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


def _url() -> str:
    url = get_settings().database_url
    # Supabase 에서 복사한 postgres:// 주소를 psycopg3 드라이버로
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


_URL = _url()
engine = create_engine(
    _URL,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if _URL.startswith("sqlite") else {},
)
if _URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _fk_on(conn, _):  # SQLite 는 외래키(ON DELETE CASCADE)를 직접 켜야 함
        conn.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """테이블이 없으면 만듦 (로컬 SQLite 용). Supabase 는 db/schema.sql 을 SQL Editor 에서 실행."""
    from . import models  # noqa: F401  (테이블 등록)

    Base.metadata.create_all(engine)
