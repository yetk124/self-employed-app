/**
 * 서버(FastAPI)와 주고받는 모양. "domain API 명세서 v0.1"과 같게 맞춰요.
 * 이름은 서버 규칙대로 snake_case, 돈은 원 단위 정수, 날짜는 YYYY-MM-DD.
 */

export interface ApiError {
  error: { code: string; message: string }
}

export interface ListRes<T> {
  items: T[]
}

/* ---------- 가게·설정 ---------- */
export interface StoreCreateReq {
  name: string
  biz_type: string
  close_time: string
  use_template: boolean
}
export interface SettingsDto {
  name: string
  open_time: string
  close_time: string
  daily_goal: number | null
  tables: number | null
  off_weekdays: number[]
  notify: boolean
}
export interface ChannelDto {
  id: number
  name: string
  fee_rate: number
  fixed_fee: number
}

/* ---------- 식자재·메뉴 ---------- */
export interface IngredientDto {
  id: number
  name: string
  unit: string
  buy_price: number
  buy_qty: number
  unit_price: number
  used_in: number
}
export interface ChangedMenu {
  id: number
  name: string
  cost_before: number
  cost_after: number
}
export interface MenuDto {
  id: number
  name: string
  price: number
  image_url: string | null
  recipe: { ingredient_id: number; name?: string; qty: number; unit?: string }[]
}
export interface MarginDto {
  menu_id: number
  name: string
  price: number
  cost: number
  cost_rate: number
  warn: boolean
  margin_by_channel: { channel_id: number; name: string; margin: number }[]
}

/* ---------- 판매 ---------- */
export interface SalesItem {
  menu_id: number
  channel_id: number
  qty: number
}
export interface SalesPutReq {
  items: SalesItem[]
  discount: number
  refund: number
}
export interface SalesDayDto {
  date: string
  items: SalesItem[]
  discount: number
  refund: number
  totals: { revenue: number; cost: number; fee: number; profit: number }
}

/* ---------- 고정비 ---------- */
export interface FixedCostDto {
  id: number
  name: string
  amount: number
  paid_on: string
}

/* ---------- 영수증 (OCR + LLM + RAG) ---------- */
export interface ParseCandidate {
  ingredient_id: number
  name: string
  /** 0~1, 높을수록 비슷 */
  score: number
}
export interface ParsedItem {
  name: string
  qty: number
  unit: string
  amount: number
  candidates?: ParseCandidate[]
  auto_match?: number | null
}
export interface ReceiptParseRes {
  image_path: string
  date: string
  vendor: string
  total: number
  items: ParsedItem[]
  raw_text: string
}
export interface ReceiptConfirmReq {
  purchased_at: string
  vendor: string
  total: number
  ocr_source: string
  image_path: string | null
  raw_text: string | null
  fields_total: number
  fields_edited: number
  items: {
    name: string
    qty: number
    unit: string
    amount: number
    action: 'update' | 'new' | 'skip'
    ingredient_id: string | null
  }[]
}
export interface ReceiptConfirmRes {
  receipt_id: number
  updated: number
  added: number
  changed_menus: ChangedMenu[]
  past_changed: { from: string; to: string; days: number; profit_delta: number } | null
}

/* ---------- 조회 ---------- */
export interface SummaryDto {
  date: string
  text: string
  facts: Record<string, unknown>
  source: 'llm' | 'rule'
  cached: boolean
}
