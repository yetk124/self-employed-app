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
│  └─ endpoints.ts         API 명세서 v0.1 함수 모음
├─ auth/                   Supabase 로그인 (키 없으면 체험 모드)
├─ state/
│  ├─ store.ts             앱 데이터 (지금은 localStorage)
│  ├─ ui.ts                화면 상태 타입 · useUi()
│  └─ UiProvider.tsx       시트 열기, 로그인 유도(gate), 이동
├─ pages/                  주소 하나 = 파일 하나
├─ sheets/                 판매 입력, 메뉴, 식자재, 고정비, 영수증 …
├─ components/             아이콘, 탭바, 그래프, 공용 조각
├─ lib/
│  ├─ calc.ts              원가·마진·지표 계산 (가격 이력 포함)
│  ├─ insights.ts          인사이트·알림·거래 내역
│  ├─ receipt.ts           영수증 읽기·매칭·저장 전 확인
│  ├─ demo.ts              예시·임시 데이터
│  └─ date.ts · format.ts · chart.ts · image.ts · pwa.ts
├─ data/                   업종 템플릿, 약관
└─ types/
   ├─ index.ts             앱 데이터 모양
   └─ api.ts               서버와 주고받는 모양 (snake_case)
```

## 데이터 흐름

- 화면은 `useStore()` 로 읽고 `store.update(s => …)` 로 고쳐요. 바꾸면 자동 저장·다시 그림.
- 서버가 생기면 `api/endpoints.ts` 의 함수로 하나씩 바꿔 끼워요. 영수증 `parse`·`confirm` 은 `VITE_API_BASE` 가 있으면 이미 서버를 불러요.
- 가격 이력: 식자재 단가·메뉴 판매가·레시피를 날짜별(`hist`)로 기록하고, 장부·지표는 그 날짜 값으로 계산해요 (`lib/calc.ts`).

## 환경변수 (`frontend/.env`)

`VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` (없으면 로그인 체험 모드) · `VITE_API_BASE` (없으면 영수증 사진 인식 꺼짐) · `VITE_GA4_ID`

## 확인

`npm run dev` → http://localhost:5173/app/ · `npm run typecheck` · `npm run lint` · `npm test`
