"""영수증 글자 → 품목 (규칙 기반). LLM 이 없거나 실패했을 때 쓰는 대체 방법이에요.
프론트 lib/receipt.ts 의 parseReceipt 와 같은 규칙.
"""

import re
from dataclasses import dataclass, field

UNITS = ["g", "ml", "개", "장", "모", "봉", "팩", "단", "병", "마리"]
SKIP = re.compile(r"합계|총액|총\s?금액|부가세|과세|면세|카드|승인|거스름|받은|현금|포인트|할인|사업자|대표|전화|tel|주소|영수증|단말기|일시|번호|매출", re.I)


@dataclass
class ParsedItem:
    name: str
    qty: float
    unit: str
    amount: int


@dataclass
class Parsed:
    date: str = ""
    vendor: str = ""
    total: int = 0
    items: list[ParsedItem] = field(default_factory=list)


def normalize_unit(qty: float, unit: str) -> tuple[float, str]:
    """kg→g, L→ml, ea·구→개 로 통일"""
    u = (unit or "").strip().lower()
    if u == "kg":
        return qty * 1000, "g"
    if u in ("l", "리터"):
        return qty * 1000, "ml"
    if u in ("ea", "구", "pcs"):
        return qty, "개"
    return qty, (u if u in UNITS else "개")


def parse_text(text: str) -> Parsed:
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in str(text).splitlines()]
    lines = [ln for ln in lines if ln]
    p = Parsed()
    dm = re.search(r"(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})", text)
    if dm:
        p.date = f"{dm[1]}-{int(dm[2]):02d}-{int(dm[3]):02d}"
    for line in lines:
        am = re.search(r"(\d{1,3}(?:,\d{3})+|\d{3,})\s*원?\s*$", line)
        if re.search(r"합계|총액|총\s?금액", line) and am:
            p.total = int(am[1].replace(",", ""))
            continue
        if not p.vendor and not re.search(r"\d{3,}", line.replace(",", "")) and len(line) <= 24:
            p.vendor = line
            continue
        if SKIP.search(line) or not am:
            continue
        amount = int(am[1].replace(",", ""))
        rest, mult, qty, unit = line[: am.start()].strip(), 1.0, 1.0, "개"
        mx = re.search(r"[x×*]\s*(\d+)\s*$", rest, re.I)
        if mx:
            mult, rest = float(mx[1]), rest[: mx.start()].strip()
        qm = re.search(r"(\d+(?:\.\d+)?)\s*(kg|g|ml|l|리터|개|ea|구|봉|팩|모|장|단)(?:\s+(\d{1,3}))?\s*$", rest, re.I)
        if qm:
            qty, unit = float(qm[1]), qm[2]
            if qm[3]:
                mult *= float(qm[3])
            rest = rest[: qm.start()].strip()
        else:
            tl = re.search(r"(?:\d{1,3}(?:,\d{3})+|\d+)\s+(\d{1,3})$", rest)
            if tl:
                mult, rest = float(tl[1]), rest[: tl.start()].strip()
        qty, unit = normalize_unit(qty, unit)
        qty = round(qty * mult, 2)
        name = re.sub(r"[^\w\s()·]", "", re.sub(r"^[\d\s.*#-]+", "", rest)).strip()
        if name and amount > 0:
            p.items.append(ParsedItem(name, qty, unit, amount))
    return p
