"""LLM 호출 (OpenAI 호환 /chat/completions). Gemini·Groq·OpenAI 모두 이 형식을 지원해요.

LLM_API_KEY 가 없으면 None 을 돌려주고, 부르는 쪽이 규칙 기반으로 대신해요.
"""

import json
import logging

import httpx

from ..config import get_settings

log = logging.getLogger(__name__)


def chat(system: str, user: str, json_mode: bool = False, max_tokens: int = 800) -> str | None:
    s = get_settings()
    if not s.llm_on:
        return None
    body: dict = {
        "model": s.llm_model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": 0.1,
        "max_tokens": max_tokens,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    try:
        r = httpx.post(s.llm_base_url.rstrip("/") + "/chat/completions", headers={"Authorization": f"Bearer {s.llm_api_key}"}, json=body, timeout=30)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except Exception as e:  # noqa: BLE001  (실패하면 규칙 기반으로 대신)
        log.warning("LLM 호출 실패: %s", e)
        return None


def chat_json(system: str, user: str) -> dict | None:
    out = chat(system, user, json_mode=True)
    if not out:
        return None
    try:
        return json.loads(out.strip().removeprefix("```json").removesuffix("```").strip())
    except json.JSONDecodeError:
        log.warning("LLM JSON 파싱 실패")
        return None
