/** 숫자·날짜 표시 */

export const pad = (n: number | string) => String(n).padStart(2, '0')

/** 원: 9,000원 */
export const won = (n: number) => Math.round(n).toLocaleString('ko-KR') + '원'

/** 만 단위 숫자만: 38.2, 382, −12 */
export const manN = (n: number) => {
  const a = Math.abs(n) / 10000
  const v = a >= 10 ? Math.round(a).toLocaleString('ko-KR') : a.toFixed(1).replace(/\.0$/, '')
  return (n < 0 ? '−' : '') + v
}

/** 그래프 축: 30만, 5,000 */
export const man = (n: number) => {
  const a = Math.abs(n)
  if (a >= 10000) return (a / 10000).toFixed(a >= 100000 ? 0 : 1).replace(/\.0$/, '') + '만'
  return Math.round(a).toLocaleString('ko-KR')
}

/** 달력 칸: 38.2만 */
export const cmpN = (n: number) =>
  n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + '만' : Math.round(n).toLocaleString('ko-KR')

/** 1단위당 가격: 1.5 / 1,500 */
export const fmtUnit = (v: number) => (v < 10 ? v.toFixed(2).replace(/0$/, '') : Math.round(v).toLocaleString('ko-KR'))

export const uid = () => Math.random().toString(36).slice(2, 9)
