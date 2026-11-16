"""홈·장부·지표 계산. 프론트 lib/calc.ts 와 같은 규칙이에요.

- 매출(순매출) = 총매출 − 할인 − 환불
- 지출 = 식자재 원가 + 채널 수수료·포장비 + 고정비(낸 날 전액)
- 원가는 sales 에 저장된 스냅샷(unit_cost)을 써요.
"""

import calendar
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Channel, DailyAdjustment, FixedCost, Menu, OffDay, Receipt, Sale, Store

HOUR_W = {11: 8, 12: 16, 13: 12, 14: 5, 15: 3, 16: 3, 17: 7, 18: 13, 19: 14, 20: 10, 21: 5, 22: 3}


def dim(y: int, m: int) -> int:
    return calendar.monthrange(y, m)[1]


def days_between(a: date, b: date) -> list[date]:
    return [a + timedelta(n) for n in range((b - a).days + 1)] if b >= a else []


def month_of(s: str | None) -> tuple[int, int]:
    if s:
        y, m = s.split("-")
        return int(y), int(m)
    t = date.today()
    return t.year, t.month


@dataclass
class Day:
    gross: float = 0
    discount: int = 0
    refund: int = 0
    cost: float = 0
    fee: float = 0
    cnt: int = 0
    hall: int = 0
    per: dict[int, int] = field(default_factory=dict)  # 메뉴 id → 개수
    profit_per: dict[int, float] = field(default_factory=dict)

    @property
    def revenue(self) -> float:
        return self.gross - self.discount - self.refund

    @property
    def profit(self) -> float:
        return self.revenue - self.cost - self.fee


class StoreData:
    """기간 안의 판매·할인·휴무·고정비를 한 번에 읽어 둠"""

    def __init__(self, db: Session, store: Store, start: date, end: date):
        self.store, self.start, self.end = store, start, end
        chans = list(db.scalars(select(Channel).where(Channel.store_id == store.id).order_by(Channel.id)))
        hall = next((c.id for c in chans if c.name == "홀"), chans[0].id if chans else None)
        self.days: dict[date, Day] = defaultdict(Day)
        for s in db.scalars(select(Sale).where(Sale.store_id == store.id, Sale.date >= start, Sale.date <= end)):
            d = self.days[s.date]
            d.gross += s.unit_price * s.qty
            d.cost += s.unit_cost * s.qty
            d.fee += s.fee * s.qty
            d.cnt += s.qty
            if s.channel_id == hall:
                d.hall += s.qty
            d.per[s.menu_id] = d.per.get(s.menu_id, 0) + s.qty
            d.profit_per[s.menu_id] = d.profit_per.get(s.menu_id, 0) + (s.unit_price - s.unit_cost - s.fee) * s.qty
        for a in db.scalars(select(DailyAdjustment).where(DailyAdjustment.store_id == store.id, DailyAdjustment.date >= start, DailyAdjustment.date <= end)):
            self.days[a.date].discount += a.discount
            self.days[a.date].refund += a.refund
        self.off = {o.date: o.status for o in db.scalars(select(OffDay).where(OffDay.store_id == store.id))}
        self.fixed = list(db.scalars(select(FixedCost).where(FixedCost.store_id == store.id)))
        self.menus = {m.id: m for m in db.scalars(select(Menu).where(Menu.store_id == store.id))}

    def day(self, d: date) -> Day:
        return self.days.get(d) or Day()

    def is_off(self, d: date) -> bool:
        o = self.off.get(d)
        if o == "open":
            return False
        if o == "off":
            return True
        return ((d.weekday() + 1) % 7) in (self.store.off_weekdays or [])  # 파이썬 월=0 → 일=0 기준으로

    def is_open(self, d: date) -> bool:
        return self.day(d).cnt > 0 or not self.is_off(d)

    def fixed_between(self, a: date, b: date) -> int:
        return sum(f.amount for f in self.fixed if a <= f.paid_on <= b)

    def month_fixed(self, y: int, m: int) -> tuple[int, bool]:
        """그 달 고정비. 없으면 지난달 값을 추정으로 씀"""
        v = self.fixed_between(date(y, m, 1), date(y, m, dim(y, m)))
        if v:
            return v, False
        py, pm = (y, m - 1) if m > 1 else (y - 1, 12)
        pv = self.fixed_between(date(py, pm, 1), date(py, pm, dim(py, pm)))
        return pv, pv > 0

    def month_sum(self, y: int, m: int, upto: int | None) -> dict:
        last = min(upto or dim(y, m), dim(y, m))
        today = date.today()
        rev = cost = fee = 0.0
        for d in days_between(date(y, m, 1), date(y, m, last)):
            if d > today:
                break
            x = self.day(d)
            rev += x.revenue
            cost += x.cost
            fee += x.fee
        fixed = self.fixed_between(date(y, m, 1), date(y, m, last))
        spend = cost + fee + fixed
        return {"revenue": round(rev), "spend": round(spend), "profit": round(rev - spend), "fixed": fixed}

    def range_sum(self, keys: list[date], cash: bool = False) -> dict:
        """지표용 합계 (프론트 mxSum 과 같음)"""
        today = date.today()
        t = {"gross": 0.0, "discount": 0, "refund": 0, "cogs": 0.0, "fee": 0.0, "cnt": 0, "hall": 0, "fixed": 0.0, "fix_est": False, "days": 0}
        per: dict[int, int] = defaultdict(int)
        for d in keys:
            if d > today:
                continue
            x = self.day(d)
            if x.cnt or not self.is_off(d):
                t["days"] += 1
            t["gross"] += x.gross
            t["discount"] += x.discount
            t["refund"] += x.refund
            t["cogs"] += x.cost
            t["fee"] += x.fee
            t["cnt"] += x.cnt
            t["hall"] += x.hall
            for mid, n in x.per.items():
                per[mid] += n
            mf, est = self.month_fixed(d.year, d.month)
            t["fixed"] += mf / dim(d.year, d.month)
            t["fix_est"] = t["fix_est"] or est
        if cash and keys:
            b = min(keys[-1], today)
            t["fixed"], t["fix_est"] = self.fixed_between(keys[0], b), False
        net = t["gross"] - t["discount"] - t["refund"]
        varc = t["cogs"] + t["fee"]
        t.update(net=net, gp=net - t["cogs"], cm=(net - varc) / net if net > 0 else 0, profit=net - varc - t["fixed"], per=dict(per))
        return t


def _bep(data: StoreData) -> dict:
    today = date.today()
    s = data.range_sum(days_between(today - timedelta(29), today))
    mf, est = data.month_fixed(today.year, today.month)
    cm = s["cm"] if s["net"] > 0 else 0
    month = mf / cm if cm > 0 and mf > 0 else None
    mtd = data.range_sum(days_between(date(today.year, today.month, 1), today))["net"]
    return {
        "target": round(month) if month else None,
        "achieved": round(mtd),
        "rate": round(mtd / month * 100) if month else None,
        "per_day": round(month / dim(today.year, today.month)) if month else None,
        "fixed": mf,
        "fixed_estimated": est,
        "contribution_rate": round(cm * 100, 1),
    }


def _tx(db: Session, store: Store, data: StoreData, a: date, b: date) -> list[dict]:
    out = []
    for d, x in data.days.items():
        if a <= d <= b and x.cnt:
            out.append({"type": "sales", "date": d.isoformat(), "amount": round(x.revenue), "count": x.cnt})
    for r in db.scalars(select(Receipt).where(Receipt.store_id == store.id, Receipt.purchased_at >= a, Receipt.purchased_at <= b)):
        out.append({"type": "receipt", "id": r.id, "date": r.purchased_at.isoformat(), "vendor": r.vendor, "amount": -r.total})
    for f in data.fixed:
        if a <= f.paid_on <= b:
            out.append({"type": "fixed", "id": f.id, "date": f.paid_on.isoformat(), "name": f.name, "amount": -f.amount})
    return sorted(out, key=lambda t: t["date"], reverse=True)


def dashboard(db: Session, store: Store, month: str | None) -> dict:
    y, m = month_of(month)
    today = date.today()
    is_cur = (y, m) == (today.year, today.month)
    py, pm = (y, m - 1) if m > 1 else (y - 1, 12)
    data = StoreData(db, store, date(py, pm, 1) - timedelta(14), date(y, m, dim(y, m)))
    upto = today.day if is_cur else None
    cur, prev = data.month_sum(y, m, upto), data.month_sum(py, pm, upto)
    anchor = today if is_cur else date(y, m, dim(y, m))
    week = []
    for i in range(7):
        d = anchor - timedelta(6 - i)
        x, p = data.day(d), data.day(d - timedelta(7))
        week.append(
            {
                "date": d.isoformat(),
                "revenue": round(x.revenue) if x.cnt else None,
                "prev_revenue": round(p.revenue) if p.cnt else None,
                "off": not x.cnt and data.is_off(d),
            }
        )
    return {
        "month": {**cur, "prev": prev},
        "bep": _bep(data) if is_cur else None,
        "week": week,
        "recent": _tx(db, store, data, date(y, m, 1), date(y, m, dim(y, m)))[:5],
    }


def ledger(db: Session, store: Store, month: str | None) -> dict:
    y, m = month_of(month)
    today = date.today()
    first, last = date(y, m, 1), date(y, m, dim(y, m))
    data = StoreData(db, store, min(first, today - timedelta(56)), last)
    days = []
    for d in days_between(first, last):
        x = data.day(d)
        fx = data.fixed_between(d, d)
        days.append(
            {
                "date": d.isoformat(),
                "revenue": round(x.revenue),
                "expense": 0 if d > today else round(x.cost + x.fee + fx),
                "count": x.cnt,
                "off": not x.cnt and data.is_off(d),
            }
        )
    # 이번 달 예상 매출: 지금까지 영업일 평균 × 이번 달 영업일 수 (휴무일 제외)
    act = sum(data.day(d).revenue for d in days_between(first, min(last, today)))
    if (y, m) == (today.year, today.month):
        el = sum(1 for d in days_between(first, today) if data.is_open(d))
        tot = el + sum(1 for d in days_between(today + timedelta(1), last) if not data.is_off(d))
        forecast = round(act / el * tot) if el else round(act)
    else:
        forecast = round(act)
    # 요일별 평균 (최근 8주)
    wd_rev, wd_cnt, wd_n = [0.0] * 7, [0] * 7, [0] * 7
    for b in range(1, 57):
        d = today - timedelta(b)
        x = data.day(d)
        if x.cnt:
            w = (d.weekday() + 1) % 7
            wd_rev[w] += x.revenue
            wd_cnt[w] += x.cnt
            wd_n[w] += 1
    weekday = [
        {"weekday": w, "revenue": round(wd_rev[w] / wd_n[w]) if wd_n[w] else None, "count": round(wd_cnt[w] / wd_n[w]) if wd_n[w] else None} for w in range(7)
    ]
    return {
        "month": f"{y}-{m:02d}",
        "days": days,
        "summary": data.month_sum(y, m, None),
        "transactions": _tx(db, store, data, first, last),
        "forecast": {"revenue": forecast},
        "weekday_avg": weekday,
    }


def _ranges(per: str) -> tuple[str, list[date], list[date]]:
    t = date.today()
    if per == "d":
        return "오늘", [t], [t - timedelta(1)]
    if per == "w":
        mon = t - timedelta(t.weekday())
        return "이번 주", days_between(mon, t), days_between(mon - timedelta(7), t - timedelta(7))
    first = date(t.year, t.month, 1)
    py, pm = (t.year, t.month - 1) if t.month > 1 else (t.year - 1, 12)
    return "이번 달", days_between(first, t), days_between(date(py, pm, 1), date(py, pm, min(t.day, dim(py, pm))))


def _buckets(per: str) -> list[tuple[str, list[date]]]:
    t = date.today()
    if per == "m":
        out = []
        for i in range(6):
            mm, yy = t.month - 5 + i, t.year
            while mm < 1:
                mm, yy = mm + 12, yy - 1
            s, e = date(yy, mm, 1), date(yy, mm, dim(yy, mm))
            out.append((f"{mm}월", days_between(s, min(e, t))))
        return out
    start = t - timedelta(t.weekday()) if per == "w" else t - timedelta(6)
    return [(d.isoformat(), [d]) for d in days_between(start, start + timedelta(6))]


def _slot_share(store: Store, a: int, b: int) -> float:
    o = int((store.open_time or "11:00").split(":")[0])
    c = int((store.close_time or "21:30").split(":")[0]) or 24
    tot = inside = 0
    for h in range(24):
        if not (o <= h < c if c > o else (h >= o or h < c)):
            continue
        w = HOUR_W.get(h, 1)
        tot += w
        if (a <= h < b) if b > a else (h >= a or h < b):
            inside += w
    return inside / tot if tot else 0


def metrics(db: Session, store: Store, per: str, slot: str | None) -> dict:
    t = date.today()
    data = StoreData(db, store, date(t.year, t.month, 1) - timedelta(200), t)
    label, cur_k, prev_k = _ranges(per)
    cur, prev = data.range_sum(cur_k, cash=per == "m"), data.range_sum(prev_k, cash=per == "m")
    a, b = {"lunch": (11, 14), "dinner": (17, 21)}.get(slot or "lunch", (11, 14))
    if slot and "-" in slot:
        a, b = (int(x) for x in slot.split("-"))
    tables = max(1, store.tables or 12)

    def turn(s: dict) -> float:
        return round(s["hall"] / 2 * _slot_share(store, a, b) / tables / s["days"], 2) if s["days"] else 0

    def aov(s: dict) -> int:
        return round(s["net"] / s["cnt"]) if s["cnt"] else 0

    top = sorted(cur["per"].items(), key=lambda kv: kv[1], reverse=True)[:3]
    net = cur["net"] or 0
    pct = (lambda v: round(v / net * 100, 1)) if net > 0 else (lambda v: 0)
    series = []
    for lbl, keys in _buckets(per):
        if keys and keys[0] > t:
            series.append({"label": lbl, "net": None})
            continue
        s = data.range_sum(keys)
        series.append(
            {
                "label": lbl,
                "net": round(s["net"]) if s["cnt"] else None,
                "gross_profit": round(s["gp"]) if s["cnt"] else None,
                "gross": round(s["gross"]),
                "discount": s["discount"],
                "refund": s["refund"],
                "turnover": turn(s),
                "aov": aov(s),
            }
        )
    return {
        "period": per,
        "label": label,
        "gross": round(cur["gross"]),
        "discount": cur["discount"],
        "refund": cur["refund"],
        "net": round(net),
        "gross_profit": round(cur["gp"]),
        "gross_profit_prev": round(prev["gp"]),
        "cost_rate": round(cur["cogs"] / net * 100, 1) if net > 0 else None,
        "cost_rate_prev": round(prev["cogs"] / prev["net"] * 100, 1) if prev["net"] > 0 else None,
        "net_profit": round(cur["profit"]),
        "top_menus": [{"menu_id": mid, "name": data.menus[mid].name if mid in data.menus else "?", "qty": n} for mid, n in top],
        "bep": _bep(data),
        "turnover": turn(cur),
        "turnover_estimated": True,
        "aov": aov(cur),
        "cost_ratio": {"ingredient": pct(cur["cogs"]), "fixed": pct(cur["fixed"]), "fee": pct(cur["fee"]), "profit": pct(cur["profit"]), "labor": None},
        "fixed_estimated": cur["fix_est"],
        "series": series,
    }


def week_facts(db: Session, store: Store, d: date) -> dict:
    """AI 요약에 넣을 숫자 (LLM 은 이 숫자만 문장으로 바꿈)"""
    data = StoreData(db, store, d - timedelta(20), d)
    mon = d - timedelta(d.weekday())
    cur = data.range_sum(days_between(mon, d))
    prev = data.range_sum(days_between(mon - timedelta(7), d - timedelta(7)))
    profit: dict[int, float] = defaultdict(float)
    for k in days_between(mon, d):
        for mid, p in data.day(k).profit_per.items():
            profit[mid] += p
    best = max(profit.items(), key=lambda kv: kv[1], default=None)
    return {
        "date": d.isoformat(),
        "week_revenue": round(cur["net"]),
        "prev_week_revenue": round(prev["net"]),
        "week_change_pct": round((cur["net"] - prev["net"]) / prev["net"] * 100) if prev["net"] > 0 else None,
        "best_menu": data.menus[best[0]].name if best and best[0] in data.menus else None,
        "best_menu_profit": round(best[1]) if best else None,
        "today_revenue": round(data.day(d).revenue),
        "today_entered": data.day(d).cnt > 0,
    }
