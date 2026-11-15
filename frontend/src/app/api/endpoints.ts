/**
 * API 명세서 v0.1 의 엔드포인트를 함수로 모아 둔 곳.
 * 지금 화면은 기기 저장소(state/store.ts)로 돌아가고, 서버가 생기면 여기 함수로 하나씩 바꿔 끼워요.
 * (영수증 parse/confirm 은 서버 주소가 있으면 이미 실제로 불러요.)
 */
import type {
  ChannelDto,
  FixedCostDto,
  IngredientDto,
  ListRes,
  MarginDto,
  MenuDto,
  ReceiptConfirmReq,
  ReceiptConfirmRes,
  ReceiptParseRes,
  SalesDayDto,
  SalesPutReq,
  SettingsDto,
  StoreCreateReq,
  SummaryDto,
} from '../types/api'
import { api } from './client'

/* 가게·설정 */
export const createStore = (b: StoreCreateReq) => api<{ id: number }>('/stores', { method: 'POST', body: b })
export const getSettings = () => api<SettingsDto>('/settings')
export const putSettings = (b: Partial<SettingsDto>) => api<{ ok: true }>('/settings', { method: 'PUT', body: b })
export const getChannels = () => api<ListRes<ChannelDto>>('/channels')
export const addChannel = (b: Omit<ChannelDto, 'id'>) => api<{ id: number }>('/channels', { method: 'POST', body: b })
export const putChannel = (id: number, b: Partial<ChannelDto>) => api<{ ok: true }>(`/channels/${id}`, { method: 'PUT', body: b })
export const delChannel = (id: number) => api<{ ok: true }>(`/channels/${id}`, { method: 'DELETE' })
export const getTemplate = (biz: string) => api<unknown>(`/templates/${biz}`)

/* 식자재 */
export const getIngredients = () => api<ListRes<IngredientDto>>('/ingredients')
export const addIngredient = (b: { name: string; unit: string; buy_price: number; buy_qty: number }) =>
  api<{ id: number; unit_price: number }>('/ingredients', { method: 'POST', body: b })
export const putIngredient = (id: number, b: { buy_price?: number; buy_qty?: number; name?: string; unit?: string }) =>
  api<{ unit_price: number; changed_menus: unknown[] }>(`/ingredients/${id}`, { method: 'PUT', body: b })
export const delIngredient = (id: number) => api<{ ok: true }>(`/ingredients/${id}`, { method: 'DELETE' })

/* 메뉴·마진 */
export const getMenus = () => api<ListRes<MenuDto>>('/menus')
export const addMenu = (b: Omit<MenuDto, 'id'>) => api<{ id: number; cost: number; cost_rate: number }>('/menus', { method: 'POST', body: b })
export const putMenu = (id: number, b: Partial<Omit<MenuDto, 'id'>>) => api<{ cost: number; cost_rate: number }>(`/menus/${id}`, { method: 'PUT', body: b })
export const delMenu = (id: number) => api<{ ok: true }>(`/menus/${id}`, { method: 'DELETE' })
export const getMargin = () => api<ListRes<MarginDto>>('/margin')

/* 판매·장부 */
export const getSales = (date: string) => api<SalesDayDto>(`/sales/${date}`)
export const putSales = (date: string, b: SalesPutReq) => api<SalesDayDto>(`/sales/${date}`, { method: 'PUT', body: b })
export const putAdjust = (date: string, b: { discount: number; refund: number }) => api<{ ok: true }>(`/adjustments/${date}`, { method: 'PUT', body: b })
export const putOffDay = (date: string, status: 'off' | 'open' | null) => api<{ ok: true }>(`/off-days/${date}`, { method: 'PUT', body: { status } })
export const getLedger = (month: string) => api<unknown>(`/ledger?month=${month}`)

/* 고정비 */
export const getFixedCosts = (month?: string) => api<{ items: FixedCostDto[] }>(`/fixed-costs${month ? `?month=${month}` : ''}`)
export const addFixedCost = (b: Omit<FixedCostDto, 'id'>) => api<{ id: number }>('/fixed-costs', { method: 'POST', body: b })
export const putFixedCost = (id: number, b: Partial<FixedCostDto>) => api<{ ok: true }>(`/fixed-costs/${id}`, { method: 'PUT', body: b })
export const delFixedCost = (id: number) => api<{ ok: true }>(`/fixed-costs/${id}`, { method: 'DELETE' })

/* 홈·지표 */
export const getDashboard = (month: string) => api<unknown>(`/dashboard?month=${month}`)
export const getMetrics = (period: 'd' | 'w' | 'm') => api<unknown>(`/metrics?period=${period}`)
export const getSummary = (date: string) => api<SummaryDto>(`/summary?date=${date}`)

/* 영수증 */
export function parseReceiptPhoto(file: Blob) {
  const fd = new FormData()
  fd.append('file', file, 'receipt.jpg')
  return api<ReceiptParseRes>('/receipts/parse', { method: 'POST', body: fd })
}
export const parseReceiptText = (text: string) => api<ReceiptParseRes>('/receipts/parse', { method: 'POST', body: { text } })
export const confirmReceipt = (b: ReceiptConfirmReq) => api<ReceiptConfirmRes>('/receipts/confirm', { method: 'POST', body: b })

/* 계정·알림 */
export const importLocal = (b: unknown) => api<{ store_id: number }>('/import', { method: 'POST', body: b })
export const pushSubscribe = (b: PushSubscriptionJSON) => api<{ ok: true }>('/push/subscribe', { method: 'POST', body: b })
export const logEvent = (name: string, props: Record<string, unknown>) => api<{ ok: true }>('/events', { method: 'POST', body: { name, props } })
export const deleteMe = () => api<{ ok: true }>('/me', { method: 'DELETE' })
