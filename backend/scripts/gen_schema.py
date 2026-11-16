"""Supabase(PostgreSQL)용 테이블 생성 SQL 을 models.py 에서 만들어 db/schema.sql 로 저장.

실행: python -m scripts.gen_schema
그다음 Supabase 대시보드 → SQL Editor 에 db/schema.sql 내용을 붙여넣고 Run.
(models.py 를 고치면 다시 실행)
"""

from pathlib import Path

from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex, CreateTable

from app import models  # noqa: F401
from app.database import Base

OUT = Path(__file__).resolve().parent.parent / "db" / "schema.sql"

HEAD = """-- domain 테이블 (scripts/gen_schema.py 로 생성, 직접 고치지 말고 models.py 를 고치세요)
-- Supabase → SQL Editor 에서 실행. 백엔드는 service 연결(DATABASE_URL)로만 접근하므로
-- 모든 테이블에 RLS 를 켜 두면 프론트에서 anon 키로 직접 읽는 것을 막을 수 있어요.

"""


def main() -> None:
    d = postgresql.dialect()
    parts = [HEAD]
    for t in Base.metadata.sorted_tables:
        parts.append(str(CreateTable(t, if_not_exists=True).compile(dialect=d)).strip() + ";\n")
        for ix in t.indexes:
            parts.append(str(CreateIndex(ix, if_not_exists=True).compile(dialect=d)).strip() + ";\n")
    parts.append("\n-- RLS 켜기 (anon 키로 직접 접근 차단)\n")
    parts += [f"alter table {t.name} enable row level security;\n" for t in Base.metadata.sorted_tables]
    OUT.write_text("\n".join(parts), encoding="utf-8")
    print(f"저장: {OUT}")


if __name__ == "__main__":
    main()
