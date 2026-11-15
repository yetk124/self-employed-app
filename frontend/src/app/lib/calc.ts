/**
 * 원가·마진·매출 계산. 화면 미리보기용이고, 서버가 생기면 같은 규칙으로 서버에서 계산해요.
 *
 * 가격 이력 규칙 (2026-11-09)
 *  - 식자재 단가·메뉴 판매가·레시피를 날짜별로 기록해요 (hist).
 *  - 장부·지표는 "그 날짜에 유효했던 값"으로 계산해요. 오늘 양파값이 올라도 지난 장부 이익은 그대로예요.
 *  - 서버: ingredient_price_history · menu_price_history + sales 에 unit_price·unit_cost 스냅샷
 */
import type { AppState, Channel, IngPrice, Ingredient, Menu, MenuVersion, RecipeItem } from '../types'
import { addD, dimOf, dk, ds, keysFrom, now, todayKey, wdOf } from './date'

export const D0 = '2000-01-01'

/* ---------- 가격 이력 ---------- */
export function atDate<T extends { from: string }>(h: T[] | undefined, d: string): T | null {
  let r: T | null = null
  for (const x of h ?? []) if (x.from <= d && (!r || x.from >= r.from)) r = x
  return r ?? h?.[0] ?? null
}

export function pushHist<T extends { from: string }>(h: T[], e: T) {
  const i = h.findIndex((x) => x.from === e.from)
  if (i >= 0) h[i] = e
  else h.push(e)
  h.sort((a, b) => (a.from < b.from ? -1 : 1))
}

export const ingHist = (g: Ingredient): IngPrice[] =>
  (g.hist ?? [{ from: D0, buyPrice: g.buyPrice, buyQty: g.buyQty }]).map((x) => ({ ...x }))

export const menuHist = (m: Menu): MenuVersion[] =>
  (m.hist ?? [{ from: D0, price: m.price, items: m.items }]).map((x) => ({
    ...x,
    items: x.items.map((i) => ({ ...i })),
  }))

/** 지금 값(buyPrice·buyQty)을 오늘 기준 이력과 맞춤 */
export function syncIng(g: Ingredient) {
  const x = atDate(g.hist, todayKey())
  if (x) {
    g.buyPrice = x.buyPrice
    g.buyQty = x.buyQty
  }
}

/** 예전 데이터에 이력이 없으면 만들어 둠 */
export function migrateHist(S: AppState) {
  S.ings.forEach((g) => {
    if (!Array.isArray(g.hist)) g.hist = ingHist(g)
  })
  S.menus.forEach((m) => {
    if (!Array.isArray(m.hist)) m.hist = menuHist(m)
  })
}

/* ---------- 원가 ---------- */
export const findIng = (S: Pick<AppState, 'ings'>, id: string) => S.ings.find((x) => x.id === id)
export const unitPrice = (g?: Pick<Ingredient, 'buyPrice' | 'buyQty'> | null) =>
  g && g.buyQty > 0 ? g.buyPrice / g.buyQty : 0

/** 지금 단가로 계산한 메뉴 1개 원가 */
export const menuCost = (S: Pick<AppState, 'ings'>, m: { items: RecipeItem[] }) =>
  m.items.reduce((s, it) => s + unitPrice(findIng(S, it.ing)) * (+it.qty || 0), 0)

/** 채널별 1개 팔 때 남는 돈 */
export const chMargin = (S: Pick<AppState, 'ings'>, m: { price: number; items: RecipeItem[] }, ch: Channel) =>
  m.price - menuCost(S, m) - (m.price * ch.fee) / 100 - (+ch.fixed || 0)

export const unitPriceAt = (g: Ingredient | undefined, d: string) => {
  if (!g) return 0
  const x = atDate(g.hist, d)
  return x ? (x.buyQty > 0 ? x.buyPrice / x.buyQty : 0) : unitPrice(g)
}
export const menuAt = (m: Menu, d: string): { price: number; items: RecipeItem[] } => {
  const x = atDate(m.hist, d)
  return x ? { price: x.price, items: x.items ?? [] } : m
}
/** 그 날짜 기준 메뉴 1개 원가. list를 주면 그 식자재 목록으로 계산 (영수증 저장 전 미리보기) */
export const menuCostAt = (S: AppState, m: Menu, d: string, list?: Ingredient[]) =>
  menuAt(m, d).items.reduce(
    (s, it) => s + unitPriceAt(list ? list.find((y) => y.id === it.ing) : findIng(S, it.ing), d) * (+it.qty || 0),
    0,
  )

/* ---------- 하루 합계 ---------- */
export interface DayStats {
  /** 순매출 = 총매출 − 할인 − 환불 */
  rev: number
  gross: number
  disc: number
  ref: number
  cost: number
  fee: number
  profit: number
  cnt: number
  per: { m: Menu; n: number; p: number }[]
}

export function dayStats(S: AppState, d: string): DayStats {
  const day = S.sales[d] ?? {}
  let gross = 0,
    cost = 0,
    fee = 0,
    cnt = 0
  const per: DayStats['per'] = []
  for (const mid in day) {
    const m = S.menus.find((x) => x.id === mid)
    if (!m) continue
    const pr = menuAt(m, d).price,
      c = menuCostAt(S, m, d)
    let n2 = 0,
      p2 = 0
    for (const cid in day[mid]) {
      const n = +day[mid][cid] || 0
      if (!n) continue
      const ch = S.channels.find((x) => x.id === cid) ?? { fee: 0, fixed: 0 }
      gross += pr * n
      cost += c * n
      const f = ((pr * ch.fee) / 100 + (+ch.fixed || 0)) * n
      fee += f
      n2 += n
      p2 += (pr - c) * n - f
    }
    cnt += n2
    if (n2) per.push({ m, n: n2, p: p2 })
  }
  per.sort((a, b) => b.p - a.p)
  const ad = S.adj[d] ?? { disc: 0, ref: 0 },
    disc = +ad.disc || 0,
    ref = +ad.ref || 0,
    rev = gross - disc - ref
  return { rev, gross, disc, ref, cost, fee, profit: rev - cost - fee, cnt, per }
}

/* ---------- 휴무일 ---------- */
export const regularOff = (S: AppState, k: string) => (S.settings.offDays ?? []).includes(wdOf(k))
export function isOffDay(S: AppState, k: string) {
  const o = S.off[k]
  if (o === 'open') return false
  if (o === 'off') return true
  return regularOff(S, k)
}
/** 영업일: 판매가 있으면 무조건 영업, 없으면 휴무가 아닌 날 */
export const isOpenDay = (S: AppState, k: string) => dayStats(S, k).cnt > 0 || !isOffDay(S, k)
export function toggleOff(S: AppState, k: string) {
  const reg = regularOff(S, k)
  if (isOffDay(S, k)) {
    if (reg) S.off[k] = 'open'
    else delete S.off[k]
  } else {
    if (reg) delete S.off[k]
    else S.off[k] = 'off'
  }
}

/* ---------- 목표·연속 달성 ---------- */
export function autoGoal(S: AppState) {
  const t = now()
  let sum = 0,
    n = 0
  for (let b = 1; b <= 28; b++) {
    const st = dayStats(S, dk(new Date(t.getFullYear(), t.getMonth(), t.getDate() - b)))
    if (st.cnt) {
      sum += st.rev
      n++
    }
  }
  return n ? Math.max(10000, Math.round(sum / n / 10000) * 10000) : 300000
}
export const goalOf = (S: AppState) => {
  const g = +(S.settings.goal ?? 0) || 0
  return g > 0 ? g : autoGoal(S)
}
/** 기록 없는 날(휴무)은 건너뛰고, 3일 넘게 비면 끊김. 오늘은 달성했을 때만 셈 */
export function streakOf(S: AppState, G: number) {
  const t = now(),
    today = todayKey()
  let n = 0,
    gap = 0
  for (let b = 0; b < 180; b++) {
    const k = dk(new Date(t.getFullYear(), t.getMonth(), t.getDate() - b)),
      st = dayStats(S, k)
    if (!st.cnt) {
      if (isOffDay(S, k)) continue
      if (k !== today && ++gap >= 3) break
      continue
    }
    gap = 0
    if (st.rev >= G) n++
    else if (k !== today) break
  }
  return n
}

/* ---------- 한 달·기간 합계 ---------- */
/** 지출 = 식자재 원가 + 포장비 등 채널 비용 + 고정비(낸 날 전액) */
export function monthSum(S: AppState, y: number, m: number, upto: number | null) {
  const days = dimOf(y, m),
    last = Math.min(upto || days, days),
    today = todayKey()
  let rev = 0,
    cost = 0,
    fee = 0
  for (let d = 1; d <= last; d++) {
    const k = ds(y, m, d)
    if (k > today) break
    const st = dayStats(S, k)
    rev += st.rev
    cost += st.cost
    fee += st.fee
  }
  const from = ds(y, m, 1),
    to = ds(y, m, last)
  const fixed = S.fixed.filter((f) => f.date >= from && f.date <= to).reduce((a, f) => a + (+f.amount || 0), 0)
  const spend = cost + fee + fixed
  return { rev, spend, profit: rev - spend, fixed }
}

/** 기간 합계: 매출·판매 개수 */
export function rangeSum(S: AppState, y: number, m: number, from: number, to: number) {
  let rev = 0,
    cnt = 0
  const today = todayKey()
  for (let d = from; d <= to; d++) {
    const k = ds(y, m, d)
    if (k > today) break
    const st = dayStats(S, k)
    rev += st.rev
    cnt += st.cnt
  }
  return { rev, cnt }
}

/** 한 달 고정비: 그 달 입력분, 없으면 지난달 값을 그대로 씀 (est) */
export function monthFixedOf(S: AppState, y: number, m: number) {
  const f = (yy: number, mm: number) => {
    const p = ds(yy, mm, 1).slice(0, 7)
    return S.fixed.filter((x) => x.date.slice(0, 7) === p).reduce((a, x) => a + (+x.amount || 0), 0)
  }
  const v = f(y, m)
  if (v) return { v, est: false }
  const d = new Date(y, m - 1, 1),
    pv = f(d.getFullYear(), d.getMonth())
  return { v: pv, est: pv > 0 }
}

/* ---------- 지표 ---------- */
export interface MxSum {
  gross: number
  disc: number
  ref: number
  net: number
  cogs: number
  fee: number
  gp: number
  varc: number
  /** 공헌이익률 */
  cm: number
  cnt: number
  hall: number
  fixed: number
  fixEst: boolean
  days: number
  per: Record<string, number>
  profit: number
}

/** 날짜 목록 → 지표 합계. cash=true면 고정비를 낸 날 전액으로 */
export function mxSum(S: AppState, keys: string[], cash = false): MxSum {
  const today = todayKey()
  let gross = 0,
    disc = 0,
    ref = 0,
    cogs = 0,
    fee = 0,
    cnt = 0,
    hall = 0,
    fixed = 0,
    fixEst = false,
    days = 0
  const per: Record<string, number> = {}
  keys.forEach((k) => {
    if (k > today) return
    const st = dayStats(S, k),
      day = S.sales[k] ?? {}
    if (st.cnt || !isOffDay(S, k)) days++
    gross += st.gross
    cogs += st.cost
    fee += st.fee
    cnt += st.cnt
    disc += st.disc
    ref += st.ref
    for (const mid in day) {
      hall += +day[mid].hall || 0
      const n = Object.values(day[mid]).reduce((s, v) => s + (+v || 0), 0)
      if (n) per[mid] = (per[mid] || 0) + n
    }
    const [y, m] = k.split('-').map(Number),
      mf = monthFixedOf(S, y, m - 1)
    fixed += mf.v / dimOf(y, m - 1)
    if (mf.est) fixEst = true
  })
  if (cash && keys.length) {
    const a = keys[0],
      b = keys[keys.length - 1] < today ? keys[keys.length - 1] : today
    fixed = S.fixed.filter((f) => f.date >= a && f.date <= b).reduce((x, f) => x + (+f.amount || 0), 0)
    fixEst = false
  }
  const net = gross - disc - ref,
    gp = net - cogs,
    varc = cogs + fee,
    cm = net > 0 ? (net - varc) / net : 0
  return { gross, disc, ref, net, cogs, fee, gp, varc, cm, cnt, hall, fixed, fixEst, days, per, profit: net - cogs - fee - fixed }
}

export type Period = 'd' | 'w' | 'm'

/** 고른 기간과 그 전 기간(같은 길이) */
export function mxRange(per: Period) {
  const t = now(),
    td = new Date(t.getFullYear(), t.getMonth(), t.getDate())
  if (per === 'd') return { label: '오늘', cur: keysFrom(td, td), prev: keysFrom(addD(td, -1), addD(td, -1)), pl: '어제' }
  if (per === 'w') {
    const mon = addD(td, -((td.getDay() + 6) % 7))
    return { label: '이번 주', cur: keysFrom(mon, td), prev: keysFrom(addD(mon, -7), addD(td, -7)), pl: '지난주 같은 기간' }
  }
  const f = new Date(td.getFullYear(), td.getMonth(), 1),
    pf = new Date(td.getFullYear(), td.getMonth() - 1, 1),
    pe = new Date(td.getFullYear(), td.getMonth() - 1, Math.min(td.getDate(), dimOf(pf.getFullYear(), pf.getMonth())))
  return { label: '이번 달', cur: keysFrom(f, td), prev: keysFrom(pf, pe), pl: '지난달 같은 기간' }
}

export interface Bucket {
  lbl: string
  keys: string[]
  future?: boolean
  now?: boolean
}
/** 그래프 칸: 일=최근 7일, 주=이번 주 월~일, 월=최근 6개월 */
export function mxBuckets(per: Period): Bucket[] {
  const t = now(),
    td = new Date(t.getFullYear(), t.getMonth(), t.getDate()),
    today = todayKey()
  if (per === 'm')
    return [...Array(6)].map((_, i) => {
      const s = new Date(td.getFullYear(), td.getMonth() - 5 + i, 1),
        e = new Date(s.getFullYear(), s.getMonth() + 1, 0)
      return { lbl: `${s.getMonth() + 1}월`, keys: keysFrom(s, e < td ? e : td), now: i === 5 }
    })
  const mon = addD(td, -((td.getDay() + 6) % 7))
  const days = per === 'w' ? [...Array(7)].map((_, i) => addD(mon, i)) : [...Array(7)].map((_, i) => addD(td, i - 6))
  const WDS = ['일', '월', '화', '수', '목', '금', '토']
  return days.map((d) => {
    const k = dk(d)
    return { lbl: k === today ? '오늘' : WDS[d.getDay()], keys: [k], future: k > today, now: k === today }
  })
}

/** 손익분기점(BEP) = 한 달 고정비 ÷ 공헌이익률 (최근 30일 실제 값) */
export function bepInfo(S: AppState) {
  const t = now(),
    td = new Date(t.getFullYear(), t.getMonth(), t.getDate()),
    s = mxSum(S, keysFrom(addD(td, -29), td)),
    mf = monthFixedOf(S, td.getFullYear(), td.getMonth())
  const cm = s.net > 0 ? s.cm : 0,
    month = cm > 0 && mf.v > 0 ? mf.v / cm : null,
    mtd = mxSum(S, keysFrom(new Date(td.getFullYear(), td.getMonth(), 1), td))
  return {
    cm,
    fixed: mf.v,
    fixEst: mf.est,
    month,
    perDay: month ? month / dimOf(td.getFullYear(), td.getMonth()) : null,
    mtd: mtd.net,
    rate: month ? mtd.net / month : null,
  }
}

/** 시간대 비중(영업 시간 안에서). 시간별 판매 기록이 없어서 일반 식당 분포로 추정 */
const HOUR_W: Record<number, number> = { 11: 8, 12: 16, 13: 12, 14: 5, 15: 3, 16: 3, 17: 7, 18: 13, 19: 14, 20: 10, 21: 5, 22: 3 }
export function slotShare(S: AppState, a: number, b: number) {
  const toH = (s: string) => +String(s || '0').split(':')[0],
    o = toH(S.settings.open || '11:00'),
    c = toH(S.settings.close || '21:30') || 24
  const open = (h: number) => (c > o ? h >= o && h < c : h >= o || h < c)
  let tot = 0,
    in_ = 0
  for (let h = 0; h < 24; h++) {
    if (!open(h)) continue
    const w = HOUR_W[h] || 1
    tot += w
    if (b > a ? h >= a && h < b : h >= a || h < b) in_ += w
  }
  return tot ? in_ / tot : 0
}
export const tablesN = (S: AppState) => Math.max(1, +(S.settings.tables ?? 0) || 12)
/** 회전율(하루 평균) = 시간대 홀 이용 건수 ÷ 테이블 수. 홀 이용 1건 = 홀 메뉴 2개로 가정 */
export const turnOf = (S: AppState, s: MxSum, slot: [number, number]) =>
  s.days ? ((s.hall / 2) * slotShare(S, slot[0], slot[1])) / tablesN(S) / s.days : 0
/** 객단가 = 순매출 ÷ 방문 고객 수. 고객 수 = 판매 메뉴 수로 가정 */
export const aovOf = (s: MxSum) => (s.cnt ? s.net / s.cnt : 0)

/* ---------- 영업 상태 ---------- */
export function bizStatus(S: AppState) {
  const o = S.settings.open || '11:00',
    c = S.settings.close || '21:30',
    n = now(),
    hm = n.getHours() * 60 + n.getMinutes()
  const toM = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m
    },
    om = toM(o),
    cm = toM(c)
  const open = cm > om ? hm >= om && hm < cm : hm >= om || hm < cm
  const fmtLeft = (v: number) => (v >= 60 ? `${Math.floor(v / 60)}시간${v % 60 ? ' ' + (v % 60) + '분' : ''}` : `${v}분`)
  if (open) return { on: true, label: '영업 중', sub: `마감까지 ${fmtLeft((cm - hm + 1440) % 1440)}` }
  const toOpen = (om - hm + 1440) % 1440
  return hm < om && cm > om
    ? { on: false, label: '영업 전', sub: `${fmtLeft(toOpen)} 뒤 문 열어요` }
    : { on: false, label: '영업 끝', sub: '오늘 판매를 정리해 보세요' }
}
