"""보여주기만 하는 API: 홈 · 지표 · AI 요약. 계산은 서버가 하고 화면은 그리기만 해요."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_store
from ..models import Store
from ..services import stats
from ..services.summary import get_summary

router = APIRouter(tags=["홈·지표"])


@router.get("/dashboard")
def dashboard(month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"), st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """이번 달 매출·지출·이익(지난달 같은 기간과 비교), 손익분기점, 최근 7일, 최근 거래 5개"""
    return stats.dashboard(db, st, month)


@router.get("/metrics")
def metrics(
    period: Literal["d", "w", "m"] = "w",
    slot: str | None = Query(default=None, description="lunch | dinner | 15-17"),
    st: Store = Depends(current_store),
    db: Session = Depends(get_db),
):
    """매출총이익·원가율·인기 메뉴·BEP·회전율·객단가·비용 비율 + 그래프용 series"""
    return stats.metrics(db, st, period, slot)


@router.get("/summary")
def summary(d: date | None = Query(default=None, alias="date"), refresh: bool = False, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """오늘의 AI 요약. 없으면 만들고 있으면 저장된 걸 줘요. LLM 이 없거나 실패하면 규칙 문장(source=rule)."""
    row = get_summary(db, st, d or date.today(), refresh)
    return {"date": row.date.isoformat(), "text": row.text, "facts": row.facts, "source": row.source, "cached": not refresh and row.created_at is not None}
