/**
 * 영수증 → 식자재 단가.
 * 서버가 있으면 POST /api/receipts/parse (OCR + LLM 구조화 + RAG 매칭)가 품목과 후보를 줘요.
 * 서버가 없을 때(체험 모드)는 붙여넣은 글자를 여기 규칙으로 읽어요.
 */
import { UNITS } from '../data/templates'
import type { AppState, Ingredient, Menu } from '../types'
import { D0, ingHist, menuCost, menuCostAt, pushHist, syncIng, unitPrice, unitPriceAt } from './calc'
import { todayKey } from './date'
import { pad, uid } from './format'

export const SAMPLE_RECEIPT = `행복식자재마트
2026-10-20 07:42
양파 3kg 6,900
대파 1kg 3,200
돼지고기 앞다리 2kg 25,800
두부 2모 3,000
깐마늘 500g 5,500
합계 44,400
부가세 4,036
카드승인 44,400`

export interface Parsed {
  date: string
  store: string
  total: number
  items: { name: string; qty: number; unit: string; amount: number; match?: string }[]
}

const SKIP = /합계|총액|총\s?금액|부가세|과세|면세|카드|승인|거스름|받은|현금|포인트|할인|사업자|대표|전화|tel|주소|영수증|단말기|일시|번호|매출/i

export function parseReceipt(text: string): Parsed {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  let date = '',
    store = '',
    total = 0
  const items: Parsed['items'] = []
  const dm = text.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/)
  if (dm) date = `${dm[1]}-${pad(dm[2])}-${pad(dm[3])}`
  for (const l of lines) {
    const am = l.match(/(\d{1,3}(?:,\d{3})+|\d{3,})\s*원?\s*$/)
    if (/합계|총액|총\s?금액/.test(l) && am) {
      total = +am[1].replace(/,/g, '')
      continue
    }
    if (!store && !/\d{3,}/.test(l.replace(/,/g, '')) && l.length <= 24) {
      store = l
      continue
    }
    if (SKIP.test(l) || !am) continue
    const amount = +am[1].replace(/,/g, '')
    let rest = l.slice(0, am.index).trim(),
      mult = 1,
      qty = 1,
      unit = '개'
    const mx = rest.match(/[x×*]\s*(\d+)\s*$/i)
    if (mx) {
      mult = +mx[1]
      rest = rest.slice(0, mx.index).trim()
    }
    const qm = rest.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|리터|개|ea|구|봉|팩|모|장|단)(?:\s+(\d{1,3}))?\s*$/i)
    if (qm) {
      qty = +qm[1]
      unit = qm[2].toLowerCase()
      if (qm[3]) mult *= +qm[3]
      rest = rest.slice(0, qm.index).trim()
    } else {
      const tl = rest.match(/(?:\d{1,3}(?:,\d{3})+|\d+)\s+(\d{1,3})$/)
      if (tl) {
        mult = +tl[1]
        rest = rest.slice(0, tl.index).trim()
      }
    }
    if (unit === 'kg') {
      qty *= 1000
      unit = 'g'
    }
    if (unit === 'l' || unit === '리터') {
      qty *= 1000
      unit = 'ml'
    }
    if (unit === 'ea' || unit === '구') unit = '개'
    qty = Math.round(qty * mult * 100) / 100
    const name = rest
      .replace(/^[\d\s.*#-]+/, '')
      .replace(/[^\p{L}\p{N}\s()·]/gu, '')
      .trim()
    if (name && amount > 0) items.push({ name, qty, unit, amount })
  }
  return { date, store, total, items }
}

const norm = (s: string) => String(s).replace(/\s|\(.*?\)/g, '').toLowerCase()

/** 이름으로 기존 식자재 찾기 (체험 모드용 단순 비교. 서버에선 RAG 벡터 검색) */
export function matchIng(S: Pick<AppState, 'ings'>, name: string): string {
  const n = norm(name)
  if (!n) return 'new'
  const g =
    S.ings.find((x) => norm(x.name) === n) ?? S.ings.find((x) => n.includes(norm(x.name)) || norm(x.name).includes(n))
  return g ? g.id : 'new'
}

/** 확인 화면의 품목 한 줄. o = 처음 읽어 온 값 (고친 칸 표시·정확도 계산용) */
export interface RcItem {
  /** 화면 목록용 고유 키 */
  key: string
  name: string
  qty: number
  unit: string
  amount: number
  /** 식자재 id | 'new' | 'skip' */
  match: string
  o: { name: string; qty: number | string; unit: string; amount: number | string }
}

export function toItems(S: AppState, p: Parsed): RcItem[] {
  return p.items.map((it) => {
    const x = { name: it.name, qty: +it.qty || 0, unit: UNITS.includes(it.unit) ? it.unit : '개', amount: +it.amount || 0 }
    return { ...x, key: uid(), match: it.match ?? matchIng(S, x.name), o: { ...x } }
  })
}

export interface Plan {
  upd: { it: RcItem; g: Ingredient; old: number; nu: number }[]
  add: RcItem[]
  skip: RcItem[]
  mism: { it: RcItem; g: Ingredient }[]
  menus: { m: Menu; b: number; a: number }[]
  /** 지난 날짜 영수증이면 바뀌는 장부 */
  past: { days: number; delta: number; first: string; last: string } | null
  ings: Ingredient[]
}

/** 저장 전 확인: 바뀌는 단가, 새 식자재, 원가가 바뀌는 메뉴, 지난 장부 변화 */
export function rcPlan(S: AppState, items: RcItem[], date: string): Plan {
  const ings = S.ings.map((g) => ({ ...g, hist: ingHist(g) }))
  const P: Plan = { upd: [], add: [], skip: [], mism: [], menus: [], past: null, ings }
  for (const it of items) {
    if (it.match === 'skip' || !it.name.trim() || !(+it.qty > 0) || !(+it.amount > 0)) {
      P.skip.push(it)
      continue
    }
    const g = it.match === 'new' ? null : ings.find((x) => x.id === it.match)
    if (!g) {
      P.add.push(it)
      continue
    }
    if (g.unit !== it.unit) {
      P.mism.push({ it, g })
      continue
    }
    const old = unitPriceAt(g, date)
    pushHist(g.hist!, { from: date, buyPrice: +it.amount, buyQty: +it.qty })
    syncIng(g)
    P.upd.push({ it, g, old, nu: +it.amount / +it.qty })
  }
  P.add.forEach((it) =>
    ings.push({
      id: uid(),
      name: it.name.trim(),
      unit: it.unit as Ingredient['unit'],
      buyPrice: +it.amount,
      buyQty: +it.qty,
      hist: [{ from: D0, buyPrice: +it.amount, buyQty: +it.qty }],
    }),
  )
  const today = todayKey()
  if (date < today && P.upd.length) {
    let days = 0,
      delta = 0,
      first = '',
      last = ''
    Object.keys(S.sales)
      .filter((k) => k >= date && k < today)
      .sort()
      .forEach((k) => {
        let dd = 0
        const day = S.sales[k]
        for (const mid in day) {
          const m = S.menus.find((x) => x.id === mid)
          if (!m) continue
          const n = Object.values(day[mid]).reduce((a, v) => a + (+v || 0), 0)
          if (!n) continue
          dd += (menuCostAt(S, m, k) - menuCostAt(S, m, k, ings)) * n
        }
        if (Math.round(dd)) {
          days++
          delta += dd
          first ||= k
          last = k
        }
      })
    if (days) P.past = { days, delta, first, last }
  }
  S.menus.forEach((m) => {
    const b = menuCost(S, m),
      a = menuCost({ ings }, m)
    if (Math.round(a) !== Math.round(b)) P.menus.push({ m, b, a })
  })
  return P
}

/** 품목별 안내 문장에 쓰는 지금 단가 */
export const nowUnit = (g: Ingredient) => unitPrice(g)
