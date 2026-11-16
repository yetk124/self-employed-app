"""OCR: 영수증 사진 → 글자. Google Cloud Vision (월 1,000장 무료)로 시작.
부족하면 CLOVA OCR 로 바꿀 때 이 파일의 read_image 만 고치면 돼요.
"""

import base64

import httpx

from ..config import get_settings
from ..errors import ApiError


def read_image(data: bytes) -> str:
    key = get_settings().google_vision_api_key
    if not key:
        raise ApiError(502, "OCR_FAILED", "아직 OCR 이 설정되지 않았어요. 글자로 붙여넣어 주세요.")
    body = {
        "requests": [
            {
                "image": {"content": base64.b64encode(data).decode()},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
                "imageContext": {"languageHints": ["ko"]},
            }
        ]
    }
    try:
        r = httpx.post(f"https://vision.googleapis.com/v1/images:annotate?key={key}", json=body, timeout=30)
        r.raise_for_status()
        res = r.json()["responses"][0]
    except Exception as e:  # noqa: BLE001
        raise ApiError(502, "OCR_FAILED", "영수증 글자를 읽지 못했어요. 다시 찍거나 글자로 붙여넣어 주세요.") from e
    if "error" in res:
        raise ApiError(502, "OCR_FAILED", "영수증 글자를 읽지 못했어요.")
    return res.get("fullTextAnnotation", {}).get("text", "")
