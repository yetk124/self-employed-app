"""RAG 매칭 정확도 평가 (최적화 전후 비교용).

실행: python -m scripts.eval_matching
- 한식 템플릿 식자재가 있는 임시 가게를 메모리 DB에 만들고
- app/data/eval_matching.json 의 영수증 품목 이름(20개)이 정답 식자재로 연결되는지 봐요.
  (expected 가 null 이면 가게에 없는 식자재 → 자동 선택하지 않아야 정답)
- Top-1 / Top-3 정확도와 자동 선택률을 출력해요.
임베딩 모델(EMBED_*), 가중치(matcher.W_VEC·W_STR), 기준값(MATCH_AUTO_THRESHOLD)을 바꿔 가며 비교하세요.
"""

import json
import os
import time
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.database import SessionLocal, init_db  # noqa: E402
from app.models import Store  # noqa: E402
from app.services import matcher, templates  # noqa: E402
from scripts.seed_dictionary import main as seed_dict  # noqa: E402

CASES = json.loads((Path(__file__).resolve().parent.parent / "app" / "data" / "eval_matching.json").read_text(encoding="utf-8"))


def main() -> None:
    init_db()
    seed_dict()
    with SessionLocal() as db:
        st = Store(owner_id="eval", name="평가용", biz_type="hansik", off_weekdays=[])
        db.add(st)
        db.flush()
        templates.apply(db, st, "hansik")
        db.flush()
        t0 = time.perf_counter()
        res = matcher.match(db, st.id, [c["name"] for c in CASES])
        ms = (time.perf_counter() - t0) * 1000
        top1 = top3 = auto_ok = auto_n = 0
        for c, cands in zip(CASES, res, strict=True):
            names = [x.name for x in cands]
            pick = matcher.auto_pick(cands)
            if c["expected"] is None:  # 가게에 없는 식자재 → 자동 선택 안 하고 '새 식자재'로 둬야 정답
                ok1 = ok3 = pick is None
            else:
                ok1 = bool(names) and names[0] == c["expected"]
                ok3 = c["expected"] in names
            top1 += ok1
            top3 += ok3
            if pick:
                auto_n += 1
                auto_ok += cands[0].name == c["expected"]
            mark = "O" if ok1 else "X"
            want = c["expected"] or "새 식자재"
            top = f"{names[0] if names else '-':<10} ({cands[0].score if cands else 0:.2f})"
            print(f"{mark} {c['name']:<16} → {top} 자동={'예' if pick else '아니오'}  정답: {want}")
        n = len(CASES)
        print(f"\nTop-1 {top1 / n:.0%} · Top-3 {top3 / n:.0%} · 자동 선택 {auto_n}/{n} (그중 정답 {auto_ok}) · {ms:.0f}ms")


if __name__ == "__main__":
    main()
