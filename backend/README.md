# domain 백엔드 (FastAPI)

프론트(`frontend/src/app/api/endpoints.ts`)와 **API 명세서 v0.1** 에 맞춘 서버예요.

## 바로 실행 (로컬)

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Mac: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env             # Windows: copy .env.example .env
python -m scripts.seed_dictionary   # RAG 식자재 사전 넣기 (처음 한 번)
uvicorn main:app --reload
```

- http://localhost:8000/docs → 모든 API 를 눌러서 시험할 수 있어요 (Swagger)
- 기본은 **SQLite(dev.db) + 개발용 로그인(AUTH_MODE=dev)** 이라 Supabase 없이도 돌아가요.
- 프론트와 연결: `frontend/.env` 에 `VITE_API_BASE=http://localhost:8000`

## 확인

```bash
pytest                              # API 전체 흐름 테스트 7개
ruff check .                        # 린트
python -m scripts.eval_matching     # RAG 매칭 정확도 (Top-1 / Top-3)
```

## 배포 (Render + Supabase)

1. Supabase 프로젝트 생성 → SQL Editor 에 `db/schema.sql` 붙여넣고 Run
2. Render → New Web Service → 레포 연결
   - Root Directory: `backend`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - 환경변수: `DATABASE_URL`(Supabase 연결 문자열) · `AUTH_MODE=supabase` · `SUPABASE_URL` · `CORS_ORIGINS`(Vercel 주소) · 필요하면 `GOOGLE_VISION_API_KEY` · `LLM_API_KEY`
3. 배포 후 한 번: Render Shell 에서 `python -m scripts.seed_dictionary`
4. (선택) 마감 알림: Render Cron Job 이 5분마다 `curl -X POST -H "X-Cron-Secret: $CRON_SECRET" https://<서버>/api/internal/cron/close-reminder`

## 파일 설명

```
backend/
├─ main.py                  시작점. 앱 만들기, CORS, 에러 처리, 라우터 연결, /api/health
├─ requirements.txt         설치할 패키지
├─ .env.example             환경변수 예시 (복사해서 .env)
├─ pyproject.toml           ruff·pytest 설정
├─ app/
│  ├─ config.py             환경변수 읽기 (DB 주소, 로그인 방식, OCR·LLM 키 …)
│  ├─ database.py           DB 연결 (SQLite ↔ Supabase Postgres), 테이블 만들기
│  ├─ models.py             DB 테이블 정의 18개 (가게·식자재·메뉴·판매·가격 이력 …)
│  ├─ schemas.py            요청 body 모양 검사 (Pydantic)
│  ├─ errors.py             에러를 {"error": {"code", "message"}} 로 통일
│  ├─ auth.py               로그인 확인 (Supabase 토큰 검사 / 개발 모드)
│  ├─ deps.py               지금 사용자의 가게 고르기 (X-Store-Id), 남의 가게 막기
│  ├─ routers/              ── API 주소별 코드 ──
│  │  ├─ stores.py          가게 만들기, 설정, 판매 채널, 업종 템플릿
│  │  ├─ ingredients.py     식자재 CRUD, 가격 이력
│  │  ├─ menus.py           메뉴 CRUD, 메뉴별 실제 마진 (/margin)
│  │  ├─ sales.py           판매 입력(스냅샷 저장), 할인·환불, 휴무일, 장부(/ledger)
│  │  ├─ fixed_costs.py     고정비 CRUD
│  │  ├─ views.py           홈(/dashboard), 지표(/metrics), AI 요약(/summary)
│  │  ├─ receipts.py        영수증 읽기(/parse), 저장(/confirm), 목록·상세
│  │  └─ account.py         비회원 기록 옮기기, 푸시 구독, 사용 기록, 탈퇴, 알림 cron
│  ├─ services/             ── 실제 계산·외부 연결 ──
│  │  ├─ pricing.py         가격 이력 · 판매 스냅샷 · 지난 판매 원가 다시 계산
│  │  ├─ stats.py           홈·장부·지표 숫자 계산 (프론트 calc.ts 와 같은 규칙)
│  │  ├─ templates.py       업종 템플릿 넣기, 기본 채널(홀·포장)
│  │  ├─ ocr.py             사진 → 글자 (Google Cloud Vision)
│  │  ├─ llm.py             LLM 호출 (OpenAI 호환: Gemini·Groq·OpenAI)
│  │  ├─ receipt_ai.py      영수증 글자 → 품목 JSON (LLM, 실패하면 규칙)
│  │  ├─ receipt_parser.py  영수증 글자 → 품목 (규칙 기반, LLM 대체용)
│  │  ├─ embeddings.py      글자 → 벡터 (API 또는 로컬 n-gram)
│  │  ├─ matcher.py         RAG 식자재 매칭: 후보 3개 + 점수, 자동 선택, 학습
│  │  ├─ summary.py         '이번 주 인사이트' AI 요약 (숫자는 SQL, 문장만 LLM, 하루 1번 캐싱)
│  │  └─ push.py            마감 알림 Web Push 보내기
│  └─ data/
│     ├─ templates.json         업종별 샘플 메뉴·식자재 (프론트와 같음)
│     ├─ ingredient_dictionary.json  RAG 표준 식자재 사전 (이름·별칭·단위)
│     └─ eval_matching.json     매칭 정확도 평가용 문제 20개
├─ db/schema.sql            Supabase 에 붙여넣을 테이블 생성 SQL
├─ scripts/
│  ├─ gen_schema.py         models.py → db/schema.sql 만들기
│  ├─ seed_dictionary.py    식자재 사전을 DB에 넣고 벡터 계산
│  └─ eval_matching.py      RAG 매칭 Top-1/Top-3 정확도 측정 (최적화 전후 비교)
└─ tests/test_api.py        가게 생성 → 마진 → 판매 스냅샷 → 영수증 → 지표 → 가져오기·탈퇴
```

## 핵심 규칙

- **가격 이력**: 단가·판매가·레시피를 `valid_from` 과 함께 쌓고, 판매 저장 때 그날 값으로 `unit_price·unit_cost·fee` 스냅샷. 지난 날짜 영수증이 오면 그 날짜 이후 판매 원가만 다시 계산하고 바뀐 이익(`past_changed`)을 알려 줘요.
- **메뉴 삭제**: 판매 기록이 있으면 실제로 지우지 않고 숨겨요(`archived`) → 지난 장부가 안 사라짐.
- **RAG 매칭 점수** = 0.6 × 벡터 유사도 + 0.4 × 글자 유사도, 표준 사전으로 이름 정규화, 사장님이 고른 연결은 학습해서 다음엔 1.0.
- **LLM 없이도 동작**: 키가 없으면 영수증은 규칙 파서, 요약은 규칙 문장(`source: "rule"`).
