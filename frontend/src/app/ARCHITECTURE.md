# domain 앱 프론트 구조

프로토타입(`domain 앱` HTML 한 파일)을 React + TypeScript로 옮긴 코드예요.
클래스 이름과 계산 규칙은 프로토타입과 똑같아서 화면이 같게 나와요.

## 주소 (react-router, `/app` 아래)

| 주소 | 화면 | 파일 |
|---|---|---|
| `/app/` | 홈 | `pages/Home.tsx` |
| `/app/metrics` | 지표 | `pages/Metrics.tsx` |
| `/app/ledger` (`?d=YYYY-MM-DD`) | 장부 | `pages/Ledger.tsx` |
| `/app/manage` (`?tab=ing` · `?tab=fix`) | 관리 | `pages/Manage.tsx` + `pages/manage/*` |
| `/app/settings` | 설정 | `pages/Settings.tsx` |
| `/app/auth` | 로그인·가입 | `pages/AuthPage.tsx` |
| `/app/onboarding` | 첫 설정 3단계 | `pages/Onboarding.tsx` |

시트(아래에서 올라오는 창)는 주소 없이 `state/ui.ts` 의 `layer` 로 열어요. 목록은 `App.tsx` 의 `Layer`.

## 폴더

```
src/app/
├─ main.tsx · App.tsx      시작점, 라우터, 시트 목록
├─ app.css                 프로토타입 스타일 그대로
├─ api/
│  ├─ client.ts            서버 공통 fetch (토큰 + X-Store-Id 자동)
│  ├─ sync.ts              기기 저장소 ↔ 서버 동기화 (내려받기·바뀐 것만 올리기)
│  └─ endpoints.ts         API 명세서 v0.1 함수 모음
├─ auth/                   Supabase 로그인 (키 없으면 체험 모드)
├─ state/
│  ├─ store.ts             앱 데이터 (기기 저장소, 서버와 동기화)
│  ├─ ui.ts                화면 상태 타입 · useUi()
│  └─ UiProvider.tsx       시트 열기, 로그인 유도(gate), 이동
├─ pages/                  주소 하나 = 파일 하나
├─ sheets/                 판매 입력, 메뉴, 식자재, 고정비, 영수증 …
├─ components/             아이콘, 탭바, 그래프, 공용 조각
├─ lib/
│  ├─ calc.ts              원가·마진·지표 계산 (가격 이력 포함)
│  ├─ insights.ts          인사이트·알림·거래 내역
│  ├─ receipt.ts           영수증 읽기·매칭·저장 전 확인
│  ├─ seed.ts              업종 템플릿으로 새 가게 만들기
│  └─ date.ts · format.ts · chart.ts · image.ts · pwa.ts
├─ data/                   업종 템플릿, 약관
└─ types/
   ├─ index.ts             앱 데이터 모양
   └─ api.ts               서버와 주고받는 모양 (snake_case)
```

## 데이터 흐름

- 화면은 `useStore()` 로 읽고 `store.update(s => …)` 로 고쳐요. 바꾸면 자동 저장·다시 그림.
- 처음 여는 사람은 빈 가게예요 (예시 데이터 없음). 로그인 화면 → 온보딩(업종 템플릿) → 홈.
- 로그인하면 `api/sync.ts` 가 서버 가게를 연결해요.
  - 서버에 가게가 있으면 `GET /api/state` 로 통째로 내려받아 기기 저장소를 바꿔요.
  - 없으면 기기에서 쓰던 가게를 `POST /api/import` 로 옮기거나, 온보딩이 끝날 때 만들어요.
  - 그다음부터 `store.update` 로 바뀐 것을 0.7초 모았다가 마지막으로 맞춘 상태(`domain.syncBase`)와 비교해서
    바뀐 것만 `POST/PUT/DELETE` 로 올려요. 실패하면 15초 뒤 다시 시도 (기기에는 이미 저장돼 있음).
  - 기기 id ↔ 서버 id 는 `domain.idmap` 에 적어 둬요. 서버에서 받은 건 `g12`(식자재) · `m3`(메뉴) · `f7`(고정비), 홀·포장 채널은 `hall`·`takeout`.
  - 영수증 저장은 서버가 처리하고(`/receipts/confirm`) 바로 다시 내려받아요.
- 로그인 안 한 사람은 기기에만 저장해요.
- 가격 이력: 식자재 단가·메뉴 판매가·레시피를 날짜별(`hist`)로 기록하고, 장부·지표는 그 날짜 값으로 계산해요 (`lib/calc.ts`).

## 환경변수 (`frontend/.env`)

`VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` (없으면 로그인 체험 모드) · `VITE_API_BASE` (없으면 영수증 사진 인식 꺼짐) · `VITE_GA4_ID`

## 확인

`npm run dev` → http://localhost:5173/app/ · `npm run typecheck` · `npm run lint` · `npm test`
