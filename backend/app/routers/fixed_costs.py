"""고정비: 월세·관리비처럼 매달 나가는 돈 (낸 날 전액이 그달 지출)"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_store
from ..errors import not_found
from ..models import FixedCost, Store
from ..schemas import FixedIn, FixedUpdate

router = APIRouter(prefix="/fixed-costs", tags=["고정비"])


def dto(f: FixedCost) -> dict:
    return {"id": f.id, "name": f.name, "amount": f.amount, "paid_on": f.paid_on.isoformat()}


def _get(db: Session, st: Store, fid: int) -> FixedCost:
    f = db.get(FixedCost, fid)
    if not f or f.store_id != st.id:
        raise not_found("고정비")
    return f


@router.get("")
def list_fixed(month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"), st: Store = Depends(current_store), db: Session = Depends(get_db)):
    """month 를 주면 그 달만 + 합계·테이블당 고정비, 빼면 전체(최근 순)"""
    rows = list(db.scalars(select(FixedCost).where(FixedCost.store_id == st.id).order_by(FixedCost.paid_on.desc())))
    if month:
        rows = [f for f in rows if f.paid_on.isoformat()[:7] == month]
    total = sum(f.amount for f in rows)
    return {"month": month, "total": total, "per_table": round(total / st.tables) if month and st.tables else None, "items": [dto(f) for f in rows]}


@router.post("", status_code=201)
def add_fixed(b: FixedIn, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    f = FixedCost(store_id=st.id, name=b.name.strip(), amount=b.amount, paid_on=b.paid_on)
    db.add(f)
    db.commit()
    return dto(f)


@router.put("/{fid}")
def put_fixed(fid: int, b: FixedUpdate, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    f = _get(db, st, fid)
    for k, v in b.model_dump(exclude_unset=True).items():
        setattr(f, k, v)
    db.commit()
    return {"ok": True, **dto(f)}


@router.delete("/{fid}")
def del_fixed(fid: int, st: Store = Depends(current_store), db: Session = Depends(get_db)):
    db.delete(_get(db, st, fid))
    db.commit()
    return {"ok": True}
