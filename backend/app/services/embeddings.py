"""글자 → 벡터 (RAG 검색용).

- EMBED_API_KEY·EMBED_MODEL 이 있으면 OpenAI 호환 /embeddings API 를 불러요.
- 없으면 로컬 '글자 n-gram 해시 벡터'로 대신 (무료, 오프라인). 한글 식자재 이름처럼 짧은 글자엔 이것도 꽤 잘 맞아요.
최적화 실험: scripts/eval_matching.py 로 두 방식의 정확도를 비교할 수 있어요.
"""

import hashlib
import math
import re

import httpx

from ..config import get_settings

LOCAL_MODEL = "local-ngram-256"
DIM = 256


def model_name() -> str:
    s = get_settings()
    return s.embed_model if s.embed_on else LOCAL_MODEL


def clean(t: str) -> str:
    """괄호 안 설명·숫자·단위를 빼고 비교 (예: '양파(국내산) 3kg망' → '양파 망')"""
    t = re.sub(r"\(.*?\)|\[.*?\]", " ", str(t))
    t = re.sub(r"\d+(\.\d+)?\s*(kg|g|ml|l|개|구|봉|팩|모|장|단|망|박스|box)?", " ", t, flags=re.I)
    return re.sub(r"\s+", " ", t).strip().lower()


def _local(text: str) -> list[float]:
    s = clean(text).replace(" ", "")
    v = [0.0] * DIM
    grams = [s[i : i + n] for n in (1, 2, 3) for i in range(len(s) - n + 1)] or [s]
    for g in grams:
        h = int(hashlib.md5(g.encode()).hexdigest(), 16)
        v[h % DIM] += 1.0 + 0.5 * (len(g) - 1)  # 긴 조각에 가중치
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


def embed(texts: list[str]) -> list[list[float]]:
    s = get_settings()
    if not s.embed_on:
        return [_local(t) for t in texts]
    r = httpx.post(
        s.embed_base_url.rstrip("/") + "/embeddings",
        headers={"Authorization": f"Bearer {s.embed_api_key}"},
        json={"model": s.embed_model, "input": [clean(t) or t for t in texts]},
        timeout=20,
    )
    r.raise_for_status()
    return [d["embedding"] for d in r.json()["data"]]


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)
