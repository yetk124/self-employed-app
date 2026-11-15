/** 홈·장부의 안내 문장, 알림, 거래 내역 */
import type { AppState } from '../types'
import { dayStats, goalOf, isOffDay, menuCost, streakOf } from './calc'
import { dk, ds, now, todayKey, WD, weekRange } from './date'
import { pad, won } from './format'

export type Act = { go: string; tab?: string } | { sales: true }

/**
 * 이번 주 효자 메뉴.
 * 지금은 규칙 기반이에요. LLM을 붙이면 GET /api/summary?date= 응답(text)으로 note를 바꿔요.
 */
export function insightMenu(S: AppState) {
  const t = now(),
    days = weekRange(t),
    today = todayKey()
  const agg = (range: Date[]) => {
    const map: Record<string, { m: AppState['menus'][number]; n: number; p: number }> = {}
    range.forEach((d) => {
      const k = dk(d)
      if (k > today) return
      dayStats(S, k).per.forEach((p) => {
        const a = (map[p.m.id] ??= { m: p.m, n: 0, p: 0 })
        a.n += p.n
        a.p += p.p
      })
    })
    return Object.values(map).sort((a, b) => b.p - a.p)
  }
  let list = agg(days),
    when = '이번 주'
  if (!list.length) {
    list = agg(days.map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7)))
    when = '지난주'
  }
  if (!list.length)
    return {
      k: '시작하기',
      main: '판매를 입력하면 알려 드려요',
      stats: [] as [string, string][],
      note: '영업이 끝나면 1분이면 입력할 수 있어요.',
      img: '/img/mascot.webp',
      act: { sales: true } as Act,
    }
  const b = list[0],
    r = b.m.price ? menuCost(S, b.m) / b.m.price : 0,
    tot = list.reduce((a, x) => a + Math.max(0, x.p), 0)
  return {
    k: `${when} 효자 메뉴`,
    main: b.m.name,
    stats: [
      ['남은 돈', won(b.p)],
      ['판매', `${b.n}개`],
      ['이익 비중', tot ? `${Math.round((b.p / tot) * 100)}%` : '–'],
    ] as [string, string][],
    note:
      r >= 0.4
        ? `원가율 ${Math.round(r * 100)}%로 높은 편이에요. 가격을 점검해 보세요.`
        : '잘 나가는 메뉴예요. 재료가 떨어지지 않게 챙겨 주세요.',
    img: '/img/mascot-happy.webp',
    act: { go: '/manage' } as Act,
  }
}

/** 알림: 지금 확인할 것들 */
export function alerts(S: AppState): { t: string; s: string; act: Act }[] {
  const out: { t: string; s: string; act: Act }[] = [],
    today = todayKey(),
    n = now(),
    hm = pad(n.getHours()) + ':' + pad(n.getMinutes())
  if (!dayStats(S, today).cnt && !isOffDay(S, today) && hm >= (S.settings.close || '21:30'))
    out.push({ t: '영업이 끝났어요', s: '오늘 매출을 1분 만에 입력해 주세요.', act: { sales: true } })
  S.menus.forEach((m) => {
    const r = m.price ? menuCost(S, m) / m.price : 0
    if (r >= 0.4)
      out.push({
        t: `${m.name} 원가율 ${Math.round(r * 100)}%`,
        s: '40%를 넘었어요. 가격이나 레시피 양을 점검해 보세요.',
        act: { go: '/manage' },
      })
  })
  const G = goalOf(S),
    s = streakOf(S, G)
  if (s >= 2) out.push({ t: `${s}일 연속 목표 달성 중`, s: `하루 목표 ${won(G)}을 계속 채우고 있어요.`, act: { go: '/ledger' } })
  return out
}

/** 장부 한 줄 분석: 최근 8주 요일 평균 */
export function monthTip(S: AppState) {
  const t = now(),
    rev = [0, 0, 0, 0, 0, 0, 0],
    n = [0, 0, 0, 0, 0, 0, 0]
  for (let b = 1; b <= 56; b++) {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - b),
      st = dayStats(S, dk(d))
    if (st.cnt) {
      rev[d.getDay()] += st.rev
      n[d.getDay()]++
    }
  }
  const avg = rev.map((v, i) => (n[i] ? v / n[i] : null)),
    ok = avg.map((v, i) => (v == null ? null : i)).filter((v): v is number => v != null)
  if (!ok.length) return null
  const best = ok.reduce((a, i) => (avg[i]! > avg[a]! ? i : a), ok[0]),
    worst = ok.reduce((a, i) => (avg[i]! < avg[a]! ? i : a), ok[0])
  return { best: WD[best], worst: WD[worst] }
}

export type TxKind = 'sale' | 'buy' | 'fix'
export interface Tx {
  kind: TxKind
  id?: string
  date: string
  sort: string
  time?: string
  title: string
  sub: string
  amt: number
}

/** 거래 내역: 하루 매출(+), 매입 영수증(−), 고정비(−) */
export function txList(S: AppState, y: number, m: number): Tx[] {
  const from = ds(y, m, 1),
    to = ds(y, m, new Date(y, m + 1, 0).getDate()),
    out: Tx[] = []
  for (const k in S.sales) {
    if (k < from || k > to) continue
    const st = dayStats(S, k)
    if (st.cnt)
      out.push({ kind: 'sale', date: k, sort: k + 'T23', title: k === todayKey() ? '오늘 매출' : '하루 매출', sub: `홀·포장 ${st.cnt}개`, amt: st.rev })
  }
  S.receipts.forEach((r) => {
    if (r.date >= from && r.date <= to) {
      const t = r.savedAt ? new Date(r.savedAt) : null
      out.push({
        kind: 'buy',
        id: r.id,
        date: r.date,
        sort: r.date + 'T' + (t ? pad(t.getHours()) + pad(t.getMinutes()) : '12'),
        time: t ? `${pad(t.getHours())}:${pad(t.getMinutes())}` : '',
        title: r.store || '영수증',
        sub: `단가 반영 ${r.count || 0}개`,
        amt: -(+r.total || 0),
      })
    }
  })
  S.fixed.forEach((f) => {
    if (f.date >= from && f.date <= to)
      out.push({ kind: 'fix', id: f.id, date: f.date, sort: f.date + 'T09', title: f.name, sub: '', amt: -(+f.amount || 0) })
  })
  return out.sort((a, b) => (a.sort < b.sort ? 1 : -1))
}
