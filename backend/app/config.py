"""환경변수 설정. backend/.env 에서 읽어요 (.env.example 참고)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # DB: 비우면 로컬 SQLite 파일(dev.db). 배포는 Supabase Postgres 연결 문자열
    database_url: str = "sqlite:///./dev.db"

    # 로그인 확인 방식
    #  - dev      : 토큰 없이 개발용 사용자로 통과 (로컬 개발·테스트용)
    #  - supabase : Supabase 로그인 토큰(JWT)을 검사
    auth_mode: str = "dev"
    supabase_url: str = ""
    # Supabase 대시보드 → Project Settings → API → JWT Secret (예전 방식, HS256)
    # 비워 두면 supabase_url 의 JWKS(새 방식, 비대칭 키)로 검사
    supabase_jwt_secret: str = ""

    # 프론트 주소 (CORS). 쉼표로 여러 개
    cors_origins: str = "http://localhost:5173,https://*.vercel.app"

    # OCR: Google Cloud Vision API 키 (비우면 사진 인식 불가 → 502 OCR_FAILED)
    google_vision_api_key: str = ""

    # LLM: OpenAI 호환 API (OpenAI · Gemini · Groq 모두 이 형식 지원). 비우면 규칙 기반으로 대신 처리
    llm_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    llm_api_key: str = ""
    llm_model: str = "gemini-2.0-flash"

    # 임베딩 (RAG). 비우면 로컬 글자 n-gram 벡터로 대신 처리
    embed_base_url: str = ""
    embed_api_key: str = ""
    embed_model: str = ""

    # RAG: 이 점수(0~1) 이상이면 식자재를 자동으로 골라 둠
    match_auto_threshold: float = 0.78

    # 마감 알림 (Web Push)
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@example.com"
    # Render cron 이 /api/internal/cron/close-reminder 를 부를 때 쓰는 비밀값
    cron_secret: str = ""

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_on(self) -> bool:
        return bool(self.llm_api_key)

    @property
    def embed_on(self) -> bool:
        return bool(self.embed_api_key and self.embed_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()
