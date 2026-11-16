"""홈 '이번 주 인사이트' AI 요약.
숫자는 stats.week_facts 가 SQL 로 계산하고, LLM 은 그 숫자로 문장만 만들어요 (숫자를 지어내지 않게).
하루 1번 만들어 daily_summaries 에 저장 → 다시 부르면 저장된 걸 줌.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import DailySummary, Menu, Store
from .llm import chat
from .pricing import PriceBook
from .stats import week_facts

SYSTEM = """너는 식당 사장님에게 이번 주 장사를 2~3문장으로 알려 주는 도우미야.
받은 숫자만 써. 숫자를 바꾸거나 새로 만들지 마. 반말 말고 '~해요' 체로, 제안은 1개만."""


def _rule(f: dict) -> str:
    parts = []
    if f.get("week_change_pct") is not None:
        c = f["week_change_pct"]
        parts.append(f"이번 주 매출은 지난주 같은 기간보다 {abs(c)}% {'늘었어요' if c >= 0 else '줄었어요'}.")
    if f.get("best_menu"):
        parts.append(f"가장 많이 남긴 메뉴는 {f['best_menu']}예요.")
    if f.get("warn_menus"):
        parts.append(f"{', '.join(f['warn_menus'])} 원가율이 40%를 넘어요. 가격이나 양을 점검해 보세요.")
    elif not f.get("today_entered"):
        parts.append("영업이 끝나면 오늘 판매를 입력해 주세요.")
    return " ".join(parts) or "판매를 입력하면 이번 주 흐름을 알려 드려요."


def get_summary(db: Session, store: Store, d: date, refresh: bool = False) -> DailySummary:
    row = db.scalars(select(DailySummary).where(DailySummary.store_id == store.id, DailySummary.date == d)).first()
    if row and not refresh:
        return row
    facts = week_facts(db, store, d)
    book = PriceBook(db, store)
    facts["warn_menus"] = [
        m.name
        for m in db.scalars(select(Menu).where(Menu.store_id == store.id, Menu.archived.is_(False)))
        if m.price and book.menu_cost_now(m) / m.price >= 0.4
    ]
    text = chat(SYSTEM, f"이번 주 숫자: {facts}", max_tokens=200)
    src, model = ("llm", get_settings().llm_model) if text else ("rule", None)
    text = (text or _rule(facts)).strip()
    if row:
        row.text, row.facts, row.source, row.model = text, facts, src, model
    else:
        row = DailySummary(store_id=store.id, date=d, text=text, facts=facts, source=src, model=model)
        db.add(row)
    db.commit()
    return row
