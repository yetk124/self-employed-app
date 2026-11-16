/**
 * 앱 데이터 모양.
 * 기기(localStorage)에 저장하고, 로그인하면 api/sync.ts 가 types/api.ts 모양으로 서버와 주고받아요.
 */

export type Unit = 'g' | 'ml' | '개' | '장' | '모' | '봉' | '팩' | '단' | '병' | '마리'
export type Provider = 'kakao' | 'google' | 'email'
export type BizKey =
  | 'hansik'
  | 'junsik'
  | 'ilsik'
  | 'yangsik'
  | 'bunsik'
  | 'cafe'
  | 'fastfood'
  | 'pub'
  | 'asian'
  | 'salad'
  | 'dosirak'
  | 'etc'

/** 가격 이력 한 줄: from 날짜부터 이 가격이 적용돼요 */
export interface IngPrice {
  from: string
  buyPrice: number
  buyQty: number
}

export interface Ingredient {
  id: string
  name: string
  unit: Unit
  /** 지금(오늘 기준) 산 가격(원) */
  buyPrice: number
  /** 지금(오늘 기준) 산 양 (unit 기준) */
  buyQty: number
  /** 가격 이력 (날짜 오름차순) */
  hist?: IngPrice[]
  img?: string
}

export interface RecipeItem {
  ing: string
  qty: number
}

/** 메뉴 판매가·레시피 이력 한 줄 */
export interface MenuVersion {
  from: string
  price: number
  items: RecipeItem[]
}

export interface Menu {
  id: string
  name: string
  price: number
  items: RecipeItem[]
  hist?: MenuVersion[]
  img?: string
}

export interface Channel {
  id: string
  name: string
  /** 수수료 % */
  fee: number
  /** 개당 추가 비용(원), 예: 포장 용기 */
  fixed: number
}

/** sales[날짜][메뉴 id][채널 id] = 판매 개수 */
export type DaySales = Record<string, Record<string, number>>
export type Sales = Record<string, DaySales>

/** 할인·환불: adj[날짜] */
export interface Adjust {
  disc: number
  ref: number
}

/** 임시 휴무(off) · 정기 휴무 요일인데 영업(open) */
export type OffMark = 'off' | 'open'

export interface FixedCost {
  id: string
  name: string
  amount: number
  /** 낸 날짜 YYYY-MM-DD */
  date: string
}

export type ReceiptSource = 'server' | 'device' | 'text'

export interface ReceiptLine {
  name: string
  qty: number
  unit: string
  amount: number
}

export interface ReceiptRecord {
  id: string
  date: string
  store: string
  total: number
  /** 단가에 반영한 식자재 수 */
  count: number
  /** OCR이 채운 칸 수 / 사장님이 고친 칸 수 (OCR 정확도 지표) */
  fields: number
  edited: number
  source: ReceiptSource
  savedAt?: string
  items?: ReceiptLine[]
}

export interface Settings {
  store: string
  open: string
  close: string
  notify: boolean
  lastNotified: string
  /** 하루 목표 매출 (비우면 최근 4주 평균) */
  goal?: number | string
  /** 테이블 수 */
  tables?: number | string
  /** 정기 휴무 요일 (0=일) */
  offDays: number[]
  bizSub?: string
}

export interface User {
  provider: Provider
  email: string
  name: string
  since?: string
}

export interface AppState {
  v: 2
  tpl: BizKey
  settings: Settings
  channels: Channel[]
  ings: Ingredient[]
  menus: Menu[]
  sales: Sales
  adj: Record<string, Adjust>
  off: Record<string, OffMark>
  fixed: FixedCost[]
  receipts: ReceiptRecord[]
  user?: User | null
  onboarded?: boolean
  ocrGuideSeen?: boolean
}
