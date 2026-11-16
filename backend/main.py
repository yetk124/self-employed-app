"""domain 백엔드 시작점.

실행:  uvicorn main:app --reload        (backend 폴더에서)
문서:  http://localhost:8000/docs        (Swagger, 모든 API 를 눌러서 시험할 수 있어요)
"""

from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app import errors
from app.config import get_settings
from app.database import init_db
from app.routers import account, fixed_costs, ingredients, menus, receipts, sales, stores, sync, views


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()  # 테이블이 없으면 만듦 (SQLite·처음 배포)
    yield


s = get_settings()
app = FastAPI(title="domain API", version="0.1.0", description="외식업 사장님 메뉴별 마진 앱 백엔드 (API 명세서 v0.1)", lifespan=lifespan)

origins = [o for o in s.cors_list if "*" not in o]
regex = "|".join(o.replace(".", r"\.").replace("*", "[^/]+") for o in s.cors_list if "*" in o) or None
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=regex,
    allow_methods=["*"],
    allow_headers=["*"],
)
errors.install(app)

api = APIRouter(prefix="/api")


@api.get("/health", tags=["기타"])
def health():
    return {"status": "ok", "auth_mode": s.auth_mode, "llm": s.llm_on, "embed": s.embed_on, "ocr": bool(s.google_vision_api_key)}


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


for r in (stores.router, ingredients.router, menus.router, sales.router, fixed_costs.router, views.router, receipts.router, account.router, sync.router):
    api.include_router(r)
app.include_router(api)
