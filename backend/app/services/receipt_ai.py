"""영수증 글자 → 품목 구조화 (LLM). 실패하면 규칙 기반(receipt_parser)으로 대신."""

from .llm import chat_json
from .receipt_parser import Parsed, ParsedItem, normalize_unit, parse_text

SYSTEM = """너는 한국 식자재 영수증을 정리하는 도우미야.
영수증 글자를 받아서 아래 JSON 만 출력해. 설명은 쓰지 마.
{"date":"YYYY-MM-DD 또는 빈 문자열","vendor":"가게 이름","total":합계 정수,
 "items":[{"name":"식자재 이름(브랜드·원산지·괄호 설명 빼고 짧게)","qty":숫자,"unit":"g|ml|개|장|모|봉|팩|단|병|마리","amount":금액 정수}]}
규칙: kg→g(×1000), L→ml(×1000), 수량 표기(x2, 2개)는 qty 에 곱해. 합계·부가세·카드 승인 줄은 items 에 넣지 마.
금액이나 양을 지어내지 마. 영수증에 없으면 그 품목은 빼."""


def structure(raw_text: str) -> tuple[Parsed, str]:
    """(결과, 'llm' | 'rule')"""
    j = chat_json(SYSTEM, raw_text[:6000])
    if j and isinstance(j.get("items"), list):
        p = Parsed(date=str(j.get("date") or ""), vendor=str(j.get("vendor") or ""), total=int(j.get("total") or 0))
        for it in j["items"]:
            try:
                qty, unit = normalize_unit(float(it.get("qty") or 1), str(it.get("unit") or "개"))
                amt = int(float(it.get("amount") or 0))
                name = str(it.get("name") or "").strip()
                if name and amt > 0:
                    p.items.append(ParsedItem(name, round(qty, 2), unit, amt))
            except (TypeError, ValueError):
                continue
        if p.items:
            # LLM 이 합계를 놓치면 규칙으로 보충
            if not p.total or not p.date:
                rule = parse_text(raw_text)
                p.total = p.total or rule.total
                p.date = p.date or rule.date
            return p, "llm"
    return parse_text(raw_text), "rule"
