import { pad } from './format'

/** 날짜 키 YYYY-MM-DD (월은 0부터) */
export const ds = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
export const dk = (d: Date) => ds(d.getFullYear(), d.getMonth(), d.getDate())
export const now = () => new Date()
export const todayKey = () => dk(now())

export const WD = ['일', '월', '화', '수', '목', '금', '토']

/** 그 달의 날 수 (월은 0부터) */
export const dimOf = (y: number, m: number) => new Date(y, m + 1, 0).getDate()

export const addD = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** a~b 날짜 키 목록 */
export function keysFrom(a: Date, b: Date) {
  const out: string[] = []
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) out.push(dk(d))
  return out
}

/** 날짜 키 → 요일 번호 */
export const wdOf = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** 11월 9일 (월) */
export const fmtDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(y, m - 1, d))
}

/** 월요일부터 7일 */
export function weekRange(anchor: Date) {
  const off = (anchor.getDay() + 6) % 7
  const mon = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - off)
  return [...Array(7)].map((_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i))
}

/** 날짜를 섞어 쓰지 않도록 고정 시드 난수 (예시 데이터용) */
export function mulberry(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
