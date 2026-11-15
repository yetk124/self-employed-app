/** 그래프 공용 */

export type Pt = [number, number]

/** 단조 3차 곡선: 값이 튀어 오르지 않게 */
export function smoothPath(p: Pt[]) {
  if (p.length < 2) return p.length ? `M${p[0][0]},${p[0][1]}` : ''
  const n = p.length,
    dx: number[] = [],
    dy: number[] = [],
    s: number[] = [],
    m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = p[i + 1][0] - p[i][0]
    dy[i] = p[i + 1][1] - p[i][1]
    s[i] = dy[i] / dx[i]
  }
  m[0] = s[0]
  m[n - 1] = s[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) {
      m[i] = m[i + 1] = 0
      continue
    }
    const a = m[i] / s[i],
      b = m[i + 1] / s[i],
      h = a * a + b * b
    if (h > 9) {
      const t = 3 / Math.sqrt(h)
      m[i] = t * a * s[i]
      m[i + 1] = t * b * s[i]
    }
  }
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${(p[i][0] + h).toFixed(1)},${(p[i][1] + m[i] * h).toFixed(1)} ${(p[i + 1][0] - h).toFixed(1)},${(p[i + 1][1] - m[i + 1] * h).toFixed(1)} ${p[i + 1][0].toFixed(1)},${p[i + 1][1].toFixed(1)}`
  }
  return d
}

/** 연속된 값끼리 묶기 (기록 없는 날에서 선을 끊음) */
export function runs<T>(arr: T[], val: (v: T) => number | null, pt: (v: T, i: number) => Pt): Pt[][] {
  const out: Pt[][] = []
  let r: Pt[] = []
  arr.forEach((v, i) => {
    if (val(v) == null) {
      if (r.length) out.push(r)
      r = []
    } else r.push(pt(v, i))
  })
  if (r.length) out.push(r)
  return out
}

export const f1 = (n: number) => n.toFixed(1)
