"""표준 식자재 사전(RAG 용)을 DB에 넣고 벡터를 계산해 둬요.

실행: python -m scripts.seed_dictionary      (backend 폴더에서, 처음 한 번 + 사전 고친 뒤)
사전 내용: app/data/ingredient_dictionary.json (이름 · 별칭 · 기본 단위)
"""

import json
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal, init_db
from app.models import IngredientDictionary
from app.services.embeddings import embed, model_name

PATH = Path(__file__).resolve().parent.parent / "app" / "data" / "ingredient_dictionary.json"


def main() -> None:
    init_db()
    rows = json.loads(PATH.read_text(encoding="utf-8"))
    vecs = embed([" ".join([r["name"], *r["aliases"]]) for r in rows])
    with SessionLocal() as db:
        for r, v in zip(rows, vecs, strict=True):
            d = db.scalars(select(IngredientDictionary).where(IngredientDictionary.name == r["name"])).first() or IngredientDictionary(name=r["name"])
            d.aliases, d.default_unit, d.embedding, d.embedding_model = r["aliases"], r["default_unit"], v, model_name()
            db.add(d)
        db.commit()
    print(f"사전 {len(rows)}개 저장 (임베딩: {model_name()})")


if __name__ == "__main__":
    main()
