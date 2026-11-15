/** 예시 데이터(가입 전 둘러보기)와 그래프 확인용 임시 데이터 */
import { CH_DEFAULT, TPL } from '../data/templates'
import type { AppState, BizKey, DaySales, FixedCost, ReceiptRecord } from '../types'
import { D0, migrateHist } from './calc'
import { dk, ds, mulberry, now, todayKey } from './date'
import { uid } from './format'

/** 업종 템플릿으로 새 상태 만들기 (withSales: 예시 판매 75일치) */
export function seed(key: BizKey, withSales: boolean): AppState {
  const t = TPL[key]
  const st: AppState = {
    v: 2,
    sample: withSales,
    tpl: key,
    settings: { store: t.store, open: '11:00', close: '21:30', notify: false, lastNotified: '', offDays: withSales ? [0] : [] },
    channels: CH_DEFAULT.map((c) => ({ ...c })),
    ings: t.ings.map(([id, name, unit, buyPrice, buyQty]) => ({ id, name, unit, buyPrice, buyQty, hist: [{ from: D0, buyPrice, buyQty }] })),
    menus: t.menus.map(([id, name, price, items]) => {
      const it = items.map(([ing, qty]) => ({ ing, qty }))
      return { id, name, price, items: it, hist: [{ from: D0, price, items: it.map((x) => ({ ...x })) }] }
    }),
    sales: {},
    adj: {},
    off: {},
    fixed: [],
    receipts: [],
  }
  if (withSales) {
    const r = mulberry(20261020),
      d0 = now()
    for (let back = 1; back <= 75; back++) {
      const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - back)
      if (d.getDay() === 0) continue // 일요일 휴무
      st.sales[ds(d.getFullYear(), d.getMonth(), d.getDate())] = daySample(st, r, 1)
    }
  }
  return st
}

function daySample(S: AppState, r: () => number, wk: number, spread = 0.85): DaySales {
  const day: DaySales = {}
  S.menus.forEach((m, i) => {
    const base = ([12, 9, 6, 5][i] || 5) * wk
    day[m.id] = { hall: Math.round(base * (0.75 + r() * spread)), takeout: Math.round(base * 0.45 * r()) }
  })
  return day
}

export function sampleFixed(): FixedCost[] {
  const t = now(),
    out: FixedCost[] = [],
    today = todayKey()
  ;[-1, 0].forEach((dm) => {
    const y = t.getFullYear(),
      m = t.getMonth() + dm
    ;(
      [
        ['월세', 1500000, 1],
        ['관리비', 120000, 10],
        ['전기세', 184000, 20],
        ['가스비', 50000, 21],
      ] as const
    ).forEach(([name, amount, d]) => {
      const date = dk(new Date(y, m, d))
      if (date <= today) out.push({ id: uid(), name, amount, date })
    })
  })
  return out
}

export function sampleReceipts(): ReceiptRecord[] {
  const t = now(),
    at = (back: number, h: number, mi: number) => {
      const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - back, h, mi)
      return { date: dk(d), savedAt: d.toISOString() }
    }
  return [
    { ...at(5, 11, 20), store: '신선식품마트', total: 78000, count: 5 },
    { ...at(12, 7, 42), store: '행복식자재마트', total: 44400, count: 5 },
    { ...at(19, 9, 5), store: '한우리정육', total: 126000, count: 2 },
  ].map((r) => ({ id: uid(), fields: 0, edited: 0, source: 'text' as const, ...r }))
}

/** 예시 데이터: 어제부터 지난달 1일까지 비어 있는 영업일을 채움 */
export function fillSample(S: AppState) {
  const r = mulberry(20261030),
    t = now(),
    start = new Date(t.getFullYear(), t.getMonth() - 1, 1)
  for (let d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1); d >= start; d.setDate(d.getDate() - 1)) {
    const k = dk(d)
    if (d.getDay() === 0 || S.sales[k]) continue
    S.sales[k] = daySample(S, r, 1)
  }
}

/** 임시 데이터 (그래프 확인용) — 설정에서 한 번에 지울 수 있음 */
export function fillDemo(S: AppState) {
  const D = (S.demo ??= { days: [], fixed: [], receipts: [] }),
    t = now(),
    start = new Date(t.getFullYear(), t.getMonth() - 1, 1),
    r = mulberry(+todayKey().replace(/-/g, ''))
  for (let d = new Date(t.getFullYear(), t.getMonth(), t.getDate()); d >= start; d.setDate(d.getDate() - 1)) {
    const k = dk(d)
    if (S.sales[k]) continue
    const wk = [0.7, 0.85, 0.9, 0.88, 1, 1.2, 1.25][d.getDay()],
      day: DaySales = {}
    S.menus.forEach((m, i) => {
      const base = ([12, 9, 6, 5][i] || 5) * wk
      day[m.id] = { hall: Math.round(base * (0.8 + r() * 0.6)), takeout: Math.round(base * 0.4 * (0.5 + r() * 0.8)) }
    })
    S.sales[k] = day
    D.days.push(k)
    if (r() < 0.4) S.adj[k] = { disc: (1 + Math.floor(r() * 4)) * 1000, ref: r() < 0.3 ? S.menus[0].price : 0 }
  }
  const mo = [0, -1].map((dm) => dk(new Date(t.getFullYear(), t.getMonth() + dm, 1)).slice(0, 7))
  mo.forEach((m) => {
    if (!S.fixed.some((f) => f.date.slice(0, 7) === m)) {
      const add = sampleFixed().filter((f) => f.date.slice(0, 7) === m)
      add.forEach((f) => D.fixed.push(f.id))
      S.fixed.push(...add)
    }
  })
  if (!S.receipts.length) {
    const rc = sampleReceipts()
    rc.forEach((x) => D.receipts.push(x.id))
    S.receipts = rc
  }
}

export function clearDemo(S: AppState) {
  const D = S.demo
  if (!D) return 0
  const n = D.days.length
  D.days.forEach((k) => {
    delete S.sales[k]
    delete S.adj[k]
  })
  S.fixed = S.fixed.filter((f) => !D.fixed.includes(f.id))
  S.receipts = S.receipts.filter((x) => !D.receipts.includes(x.id))
  S.demo = { days: [], fixed: [], receipts: [] }
  S.demoOff = true
  return n
}

/** 앱을 열 때·날짜가 바뀔 때 한 번: 이력 만들기, 예시·임시 데이터 채우기 */
export function boot(S: AppState) {
  migrateHist(S)
  const today = todayKey()
  if (S.sample && S.filledOn !== today) {
    if (!S.receipts.length) S.receipts = sampleReceipts()
    fillSample(S)
    const mo = today.slice(0, 7)
    if (!S.fixed.length) S.fixed = sampleFixed()
    else if (!S.fixed.some((f) => f.date.slice(0, 7) === mo)) S.fixed.push(...sampleFixed().filter((f) => f.date.slice(0, 7) === mo))
    S.filledOn = today
  }
  if (S.menus.length && !S.demoOff && S.demoOn !== today) {
    fillDemo(S)
    S.demoOn = today
  }
}
