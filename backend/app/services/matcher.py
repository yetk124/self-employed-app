"""RAG 식자재 매칭: 영수증 품목 이름 → 우리 가게 식자재 후보 3개 + 점수(0~1).

점수 = 하이브리드
  0.6 × 벡터 유사도(임베딩)  +  0.4 × 글자 유사도(difflib)
  + 사장님이 예전에 고른 연결(ingredient_aliases)이면 1.0
  + 표준 사전(ingredient_dictionary)의 별칭으로 정규화한 이름도 같이 비교
pgvector 대신 파이썬으로 계산해요 (가게당 식자재가 수십 개라 충분히 빠름).
식자재가 수천 개로 늘면 Supabase pgvector 의 <=> 연산으로 바꾸면 돼요.
"""

from dataclasses import dataclass
from difflib import SequenceMatcher

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Ingredient, IngredientAlias, IngredientDictionary
from .embeddings import clean, cosine, embed, model_name

W_VEC, W_STR = 0.6, 0.4


@dataclass
class Candidate:
    ingredient_id: int
    name: str
    score: float


def _str_sim(a: str, b: str) -> float:
    a, b = clean(a).replace(" ", ""), clean(b).replace(" ", "")
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    base = SequenceMatcher(None, a, b).ratio()
    return max(base, 0.85) if (a in b or b in a) else base


def ensure_embeddings(db: Session, ings: list[Ingredient]) -> None:
    """식자재 벡터가 없거나 모델이 바뀌었으면 새로 계산해서 저장"""
    mname = model_name()
    todo = [g for g in ings if not g.embedding or g.embedding_model != mname]
    if not todo:
        return
    for g, v in zip(todo, embed([g.name for g in todo]), strict=True):
        g.embedding, g.embedding_model = v, mname
    db.flush()


def _canonical(db: Session, name: str, qv: list[float]) -> str | None:
    """표준 사전으로 정규화: '돈육 앞다리' → '돼지고기', '깐마늘' → '마늘'"""
    c = clean(name).replace(" ", "")
    best, best_s = None, 0.0
    for d in db.scalars(select(IngredientDictionary)):
        names = [d.name, *(d.aliases or [])]
        s = max(_str_sim(c, n) for n in names)
        if any(clean(n).replace(" ", "") == c for n in names):
            s = 1.0
        if d.embedding and d.embedding_model == model_name():
            s = max(s, cosine(qv, d.embedding) * 0.9)
        if s > best_s:
            best, best_s = d.name, s
    return best if best_s >= 0.75 else None


def match(db: Session, store_id: int, names: list[str], k: int = 3) -> list[list[Candidate]]:
    ings = list(db.scalars(select(Ingredient).where(Ingredient.store_id == store_id)))
    if not ings or not names:
        return [[] for _ in names]
    ensure_embeddings(db, ings)
    aliases = {a.alias: a.ingredient_id for a in db.scalars(select(IngredientAlias).where(IngredientAlias.store_id == store_id))}
    qvs = embed(names)
    out = []
    for name, qv in zip(names, qvs, strict=True):
        canon = _canonical(db, name, qv)
        learned = aliases.get(clean(name))
        scored = []
        for g in ings:
            vec = cosine(qv, g.embedding or [])
            st = _str_sim(name, g.name)
            if canon:
                st = max(st, _str_sim(canon, g.name) * 0.95)
            s = W_VEC * vec + W_STR * st
            s = max(s, st if st >= 0.95 else 0)  # 이름이 거의 같으면 그대로 높게
            if learned == g.id:
                s = 1.0
            scored.append(Candidate(g.id, g.name, round(min(1.0, s), 3)))
        scored.sort(key=lambda c: c.score, reverse=True)
        out.append(scored[:k])
    return out


def auto_pick(cands: list[Candidate]) -> int | None:
    """1등 점수가 기준 이상이고 2등과 차이가 나면 자동 선택"""
    if not cands:
        return None
    th = get_settings().match_auto_threshold
    top = cands[0]
    gap = top.score - (cands[1].score if len(cands) > 1 else 0)
    return top.ingredient_id if top.score >= th and (gap >= 0.05 or top.score >= 0.97) else None


def learn(db: Session, store_id: int, raw_name: str, ingredient_id: int) -> None:
    """사장님이 확인한 연결을 기억"""
    key = clean(raw_name)
    if not key:
        return
    row = db.scalars(select(IngredientAlias).where(IngredientAlias.store_id == store_id, IngredientAlias.alias == key)).first()
    if row:
        row.ingredient_id = ingredient_id
    else:
        db.add(IngredientAlias(store_id=store_id, alias=key, ingredient_id=ingredient_id))
