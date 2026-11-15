/** 그래프들 (SVG). 프로토타입 계산·클래스 그대로 */
import type { ReactNode } from 'react'
import { dayStats, isOffDay, rangeSum, type Bucket, isOpenDay } from '../lib/calc'
import { smoothPath, runs, f1, type Pt } from '../lib/chart'
import { dimOf, dk, ds, now, todayKey, WD } from '../lib/date'
import { man, manN, won } from '../lib/format'
import type { AppState } from '../types'
import { CardHead } from './bits'
import Icon, { Arrow } from './Icon'

const STEPS = [50000, 100000, 200000, 500000, 1000000]

/* ===== 홈: 주간 매출 추이 (최근 7일 선, 그 전 7일 점선) ===== */
export function WeekCard({ S, y, m, wsel, onSel, onMore }: { S: AppState; y: number; m: number; wsel: string; onSel: (k: string) => void; onMore: () => void }) {
  const today = todayKey(),
    t = now(),
    anc = y === t.getFullYear() && m === t.getMonth() ? t : new Date(y, m + 1, 0),
    isCur = dk(anc) === today
  const days = [...Array(7)].map((_, i) => new Date(anc.getFullYear(), anc.getMonth(), anc.getDate() - 6 + i)),
    prevDays = days.map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))
  const cur = days.map((d) => {
    const k = dk(d),
      st = dayStats(S, k)
    return { k, d, rev: k > today || !st.cnt ? null : st.rev }
  })
  const prv = prevDays.map((d) => {
    const k = dk(d),
      st = dayStats(S, k)
    return { k, d, rev: st.cnt ? st.rev : null }
  })
  const sumTo = (arr: { rev: number | null }[], n: number) => arr.slice(0, n + 1).reduce((a, v) => a + (v.rev || 0), 0)
  let ancIdx = 6
  while (ancIdx > 0 && cur[ancIdx].rev == null && cur[ancIdx].k >= today) ancIdx--
  const curSum = sumTo(cur, ancIdx),
    prvSum = sumTo(prv, ancIdx),
    pct = prvSum > 0 ? Math.round(((curSum - prvSum) / prvSum) * 100) : null
  const label = isCur ? '최근 7일' : `${m + 1}월 마지막 7일`,
    range = `${days[0].getMonth() + 1}.${days[0].getDate()} – ${days[6].getMonth() + 1}.${days[6].getDate()}`
  const head = (
    <div className="hc-h">
      <h2 id="h-trend">주간 매출 추이</h2>
      <button className="more" onClick={onMore}>
        지표에서 보기 <Icon name="chev" />
      </button>
    </div>
  )
  if (!cur.some((v) => v.rev) && !prv.some((v) => v.rev))
    return (
      <>
        {head}
        <p className="hint" style={{ margin: '6px 0 4px' }}>
          {label}({range}) 입력한 매출이 없어요.
        </p>
      </>
    )
  const W = 326,
    H = 160,
    L = 34,
    R = 12,
    T = 30,
    B = 24,
    iw = W - L - R,
    ih = H - T - B
  const all = [...cur, ...prv].map((v) => v.rev).filter((v): v is number => v != null),
    hi = Math.max(...all),
    lo = Math.min(...all)
  const span = Math.max(hi - lo, hi * 0.25),
    step = STEPS.find((s) => span / s <= 4) || 1000000
  const min = Math.max(0, Math.floor((lo - span * 0.15) / step) * step),
    max = Math.ceil((hi + span * 0.1) / step) * step || step
  const x = (i: number) => L + i * (iw / 6),
    yv = (v: number) => T + ih - ((v - min) / (max - min)) * ih
  const grid: ReactNode[] = []
  for (let v = min; v <= max + 1; v += step)
    grid.push(
      <g key={'g' + v}>
        <line className="gl wk-gl" x1={L} x2={W - R} y1={f1(yv(v))} y2={f1(yv(v))} />
        <text className="ax num" x={L - 7} y={f1(yv(v) + 3.5)} textAnchor="end">
          {v ? man(v) : '0'}
        </text>
      </g>,
    )
  const pt = (v: { rev: number | null }, i: number): Pt => [x(i), yv(v.rev!)]
  let sel = cur.findIndex((v) => v.k === wsel && v.rev != null)
  if (sel < 0)
    for (let i = 6; i >= 0; i--)
      if (cur[i].rev != null) {
        sel = i
        break
      }
  let best = -1
  cur.forEach((v, i) => {
    if (v.rev != null && (best < 0 || v.rev > cur[best].rev!)) best = i
  })
  const tip = (() => {
    if (sel < 0) return null
    const v = cur[sel],
      px = x(sel),
      py = yv(v.rev!),
      pv = prv[sel].rev,
      dp = pv ? Math.round(((v.rev! - pv) / pv) * 100) : null
    const bw = 108,
      bh = 42,
      bx = Math.min(W - 2 - bw, Math.max(L - 6, px - bw / 2)),
      by = Math.max(2, py - bh - 12),
      tx = Math.min(bx + bw - 9, Math.max(bx + 9, px))
    const dc = dp == null ? '' : dp > 0 ? 'up' : dp < 0 ? 'down' : 'flat',
      dl = dp == null ? '' : `${dp > 0 ? '+' : dp < 0 ? '−' : ''}${Math.abs(dp)}%`,
      pw = dl.length * 6 + 12
    return {
      guide: <line className="wk-guide" x1={f1(px)} x2={f1(px)} y1={f1(py + 6)} y2={T + ih} />,
      box: (
        <g className="wk-tip" aria-hidden="true">
          <rect x={f1(bx)} y={f1(by)} width={bw} height={bh} rx="10" />
          <path className="tail" d={`M${f1(tx - 4)},${f1(by + bh - 0.5)} Q${f1(tx)},${f1(by + bh + 5)} ${f1(tx + 4)},${f1(by + bh - 0.5)}Z`} />
          <text x={f1(bx + 10)} y={f1(by + 16)} className="t1">
            {`${v.d.getMonth() + 1}.${v.d.getDate()} (${WD[v.d.getDay()]})`}
          </text>
          {dl && (
            <>
              <rect className={`dp ${dc}`} x={f1(bx + bw - 8 - pw)} y={f1(by + 6)} width={pw} height="14" rx="7" />
              <text x={f1(bx + bw - 8 - pw / 2)} y={f1(by + 16.5)} textAnchor="middle" className={`dpt ${dc} num`}>
                {dl}
              </text>
            </>
          )}
          <text x={f1(bx + 10)} y={f1(by + 34)} className="t2 num">
            {manN(v.rev!)}
            <tspan className="u" dx="1">
              만원
            </tspan>
          </text>
        </g>
      ),
    }
  })()
  const bd = best >= 0 ? cur[best] : null
  return (
    <>
      {head}
      <div className="wk-top">
        <div>
          <span className="wk-l">
            {label} 매출 <small className="num">{range}</small>
          </span>
          <b className="wk-v num">
            {manN(curSum)}
            <small>만원</small>
          </b>
          {pct != null && (
            <span className={`wk-d ${pct >= 0 ? 'up' : 'down'} num`}>
              <Arrow up={pct >= 0} />
              {Math.abs(pct)}%<small> 그 전 7일보다</small>
            </span>
          )}
        </div>
        <div className="wk-lg">
          <span>
            <i className="c" />
            최근 7일
          </span>
          <span>
            <i className="p" />그 전 7일
          </span>
        </div>
      </div>
      <div className="chart wk">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} 날짜별 매출 선 그래프, 점선은 그 전 7일`}>
          <defs>
            <linearGradient id="wkfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="wk-s0" />
              <stop offset="1" className="wk-s1" />
            </linearGradient>
          </defs>
          {tip?.guide}
          {grid}
          {days.map((_, i) => (
            <text key={'x' + i} className={`ax wk-x${isCur && i === 6 ? ' now' : ''}`} x={f1(x(i))} y={H - 6} textAnchor="middle">
              {isCur && i === 6 ? '오늘' : WD[days[i].getDay()]}
            </text>
          ))}
          {runs(prv, (v) => v.rev, pt).map((r, i) => r.length > 1 && <path key={'p' + i} className="wk-prev" d={smoothPath(r)} />)}
          {runs(cur, (v) => v.rev, pt).map((r, i) => {
            if (r.length < 2) return null
            const line = smoothPath(r)
            return (
              <g key={'c' + i}>
                <path className="wk-area" d={`${line} L${f1(r[r.length - 1][0])},${T + ih} L${f1(r[0][0])},${T + ih} Z`} fill="url(#wkfill)" />
                <path className="wk-line" d={line} />
              </g>
            )
          })}
          {cur.map(
            (v, i) =>
              v.rev == null &&
              v.k < today && (
                <text key={'o' + i} className="wk-off" x={f1(x(i))} y={f1(T + ih - 6)} textAnchor="middle">
                  {isOffDay(S, v.k) ? '휴무' : '미입력'}
                </text>
              ),
          )}
          {cur.map((v, i) => v.rev != null && <circle key={'pt' + i} className={`wk-pt${i === sel ? ' sel' : ''}`} cx={f1(x(i))} cy={f1(yv(v.rev))} r={i === sel ? 5.5 : 3.6} />)}
          {tip?.box}
          {cur.map(
            (v, i) =>
              v.rev != null && (
                <rect key={'h' + i} className="hit wk-hit" x={f1(x(i) - iw / 12)} y={T - 10} width={f1(iw / 6)} height={ih + 10} onClick={() => onSel(v.k)}>
                  <title>{`${v.d.getMonth() + 1}월 ${v.d.getDate()}일 ${won(v.rev)}`}</title>
                </rect>
              ),
          )}
        </svg>
      </div>
      <p className="wk-tipline">
        <Icon name="bulb" />
        <span>
          {bd ? (
            <>
              <b>
                {WD[bd.d.getDay()]}요일({bd.d.getMonth() + 1}.{bd.d.getDate()})
              </b>{' '}
              매출이 {manN(bd.rev!)}만원으로 가장 많았어요!
              {[0, 5, 6].includes(bd.d.getDay()) ? ' 주말 판매에 집중하면 매출을 더 높일 수 있어요.' : ' 잘 되는 요일의 메뉴 구성을 다른 날에도 써 보세요.'}
            </>
          ) : (
            '매출을 입력하면 분석해 드려요.'
          )}
        </span>
      </p>
    </>
  )
}

/* ===== 지표: 선 그래프 (여러 줄 + BEP 점선) ===== */
export interface MxLine {
  name: string
  cls: string
  vals: (number | null)[]
}
export function MxChart({
  B,
  lines,
  bep,
  h = 156,
  label = '추이 그래프',
  fmt = (v: number) => (v ? man(v) : '0'),
  tipFmt = won,
}: {
  B: Bucket[]
  lines: MxLine[]
  bep?: number | null
  h?: number
  label?: string
  fmt?: (v: number, step: number) => string
  tipFmt?: (v: number) => string
}) {
  const W = 326,
    H = h,
    L = 34,
    R = 10,
    T = 14,
    Bm = 22,
    iw = W - L - R,
    ih = H - T - Bm,
    n = B.length
  const all = lines.flatMap((l) => l.vals.filter((v): v is number => v != null))
  if (bep != null) all.push(bep)
  if (!all.length || !all.some((v) => v)) return <p className="hint">이 기간에 입력한 판매가 없어요.</p>
  const hi = Math.max(...all, 0),
    lo = Math.min(...all, 0),
    span = hi - lo || 1
  const raw = span / 4,
    mag = Math.pow(10, Math.floor(Math.log10(raw))),
    step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw)!
  const min = Math.floor(lo / step) * step,
    max = Math.ceil(hi / step) * step || step
  const x = (i: number) => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw),
    yv = (v: number) => T + ih - ((v - min) / (max - min || 1)) * ih
  const grid: ReactNode[] = []
  for (let v = min; v <= max + step / 2; v += step)
    grid.push(
      <g key={'g' + v}>
        <line className="gl wk-gl" x1={L} x2={W - R} y1={f1(yv(v))} y2={f1(yv(v))} />
        <text className="ax num" x={L - 6} y={f1(yv(v) + 3.5)} textAnchor="end">
          {fmt(v, step)}
        </text>
      </g>,
    )
  return (
    <div className="chart mx">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {grid}
        {B.map((b, i) => (
          <text key={'x' + i} className={`ax wk-x${b.now ? ' now' : ''}`} x={f1(x(i))} y={H - 5} textAnchor="middle">
            {b.lbl}
          </text>
        ))}
        {bep != null && bep > 0 && (
          <>
            <line className="mx-bep" x1={L} x2={W - R} y1={f1(yv(bep))} y2={f1(yv(bep))} />
            <text className="mx-bept" x={W - R} y={f1(yv(bep) - 5)} textAnchor="end">
              BEP
            </text>
          </>
        )}
        {lines.map((l) => {
          const pts = l.vals.map((v, i) => (v == null ? null : ([x(i), yv(v)] as Pt))).filter((p): p is Pt => !!p)
          if (pts.length > 1) return <path key={l.name} className={`mx-ln ${l.cls}`} d={smoothPath(pts)} />
          if (pts.length === 1) return <circle key={l.name} className={`mx-pt ${l.cls}`} cx={f1(pts[0][0])} cy={f1(pts[0][1])} r="2.6" />
          return null
        })}
        {B.map((b, i) =>
          b.future ? null : (
            <rect key={'h' + i} className="hit" x={f1(x(i) - iw / n / 2)} y={T} width={f1(iw / n)} height={ih} fill="transparent">
              <title>{`${b.lbl} ${lines.map((l) => `${l.name} ${l.vals[i] == null ? '–' : tipFmt(l.vals[i]!)}`).join(' · ')}`}</title>
            </rect>
          ),
        )}
      </svg>
    </div>
  )
}

export function MxLegend({ items }: { items: [string, string][] }) {
  return (
    <div className="mx-lg">
      {items.map(([c, l]) => (
        <span key={c}>
          <i className={c} />
          {l}
        </span>
      ))}
    </div>
  )
}

/* ===== 장부: 월별 비교 (전전달·지난달·이번 달 예상) ===== */
export function MonthCompare({ S, y, m }: { S: AppState; y: number; m: number }) {
  const t = now(),
    isCur = y === t.getFullYear() && m === t.getMonth(),
    mm = (k: number) => {
      const d = new Date(y, m + k, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    }
  const full = (p: { y: number; m: number }) => rangeSum(S, p.y, p.m, 1, dimOf(p.y, p.m)).rev
  const a = mm(-2),
    b = mm(-1),
    days = dimOf(y, m)
  const va = full(a),
    vb = full(b),
    act = full({ y, m })
  let elO = 0,
    totO = 0
  if (isCur)
    for (let d = 1; d <= days; d++) {
      const k = ds(y, m, d),
        o = d <= t.getDate() ? isOpenDay(S, k) : !isOffDay(S, k)
      if (o) {
        totO++
        if (d <= t.getDate()) elO++
      }
    }
  const proj = isCur && elO ? Math.round((act / elO) * totO) : act
  const cols: [string, number, 'past' | 'cur' | 'sel'][] = [
    [`${a.m + 1}월 총 매출`, va, 'past'],
    [`${b.m + 1}월 총 매출`, vb, 'past'],
    [isCur ? `${m + 1}월 예상 매출` : `${m + 1}월 총 매출`, proj, isCur ? 'cur' : 'sel'],
  ]
  const mx = Math.max(1, ...cols.map((c) => c[1])),
    diff = proj - vb,
    H = 120
  const head = isCur ? (
    vb ? (
      <>
        지난달보다 <b className="num">{manN(Math.abs(diff))}만원</b> {diff >= 0 ? '더 벌 것 같아요' : '덜 벌 것 같아요'}
      </>
    ) : (
      '이번 달 흐름으로 예상했어요'
    )
  ) : vb ? (
    <>
      {b.m + 1}월보다 <b className="num">{manN(Math.abs(diff))}만원</b> {diff >= 0 ? '늘었어요' : '줄었어요'}
    </>
  ) : null
  return (
    <>
      <CardHead title={isCur ? `${m + 1}월 예상 매출` : `${m + 1}월 매출`} id="h-mc" />
      <p className="c2-sub">{head}</p>
      <div className="mc">
        {cols.map(([l, v, k]) => {
          const h = Math.max(6, Math.round((v / mx) * H)),
            ah = k === 'cur' && isCur ? Math.max(4, Math.round((act / mx) * H)) : h
          return (
            <div key={l} className={`mc-col ${k}`}>
              <span className="mc-tag">
                {k === 'cur' && isCur && vb ? (
                  <span className="num">
                    {diff >= 0 ? '↑' : '↓'} {manN(Math.abs(diff))}만원
                  </span>
                ) : null}
              </span>
              <span className="mc-bar" style={{ height: h }}>
                {k === 'cur' && isCur && <i style={{ height: ah }} />}
              </span>
              <b className="num">{manN(v)}만원</b>
              <small>{l}</small>
            </div>
          )
        })}
      </div>
      {isCur && (
        <p className="c2-foot">
          진한 부분은 지금까지(1~{t.getDate()}일) 실제 매출, 연한 부분은 이 속도로 남은 영업일 {totO - elO}일을 채웠을 때예요. 휴무일은 빼고 계산해요.
        </p>
      )}
    </>
  )
}

/* ===== 장부: 요일별 (매출 평균 / 판매량 평균) ===== */
export function WdBars({ S, mode, onMode }: { S: AppState; mode: 'rev' | 'cnt'; onMode: (m: 'rev' | 'cnt') => void }) {
  const t = now(),
    rev = [0, 0, 0, 0, 0, 0, 0],
    cnt = [0, 0, 0, 0, 0, 0, 0],
    n = [0, 0, 0, 0, 0, 0, 0]
  for (let b = 1; b <= 56; b++) {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - b),
      st = dayStats(S, dk(d))
    if (st.cnt) {
      const i = d.getDay()
      rev[i] += st.rev
      cnt[i] += st.cnt
      n[i]++
    }
  }
  const order = [1, 2, 3, 4, 5, 6, 0],
    isCnt = mode === 'cnt'
  const avg = order.map((i) => (n[i] ? (isCnt ? cnt[i] : rev[i]) / n[i] : null)),
    vals = avg.filter((v): v is number => v != null)
  const tog = (
    <div className="seg2" role="tablist" aria-label="요일별 보기">
      <button role="tab" aria-selected={!isCnt} onClick={() => onMode('rev')}>
        매출
      </button>
      <button role="tab" aria-selected={isCnt} onClick={() => onMode('cnt')}>
        판매량
      </button>
    </div>
  )
  const head = <CardHead icon="bars" title={isCnt ? '요일별 판매량' : '요일별 매출'} right={tog} id="h-wd" />
  if (!vals.length)
    return (
      <>
        {head}
        <p className="hint">최근 8주 동안 입력한 판매가 없어요.</p>
      </>
    )
  const W = 326,
    H = 168,
    T = 26,
    B = 26,
    L = 4,
    R = 4,
    iw = W - L - R,
    ih = H - T - B,
    bw = iw / 7,
    w = Math.min(34, bw * 0.7),
    mx = Math.max(...vals) * 1.12,
    bi = avg.indexOf(Math.max(...vals))
  return (
    <>
      {head}
      <p className="c2-unit">최근 8주 평균 · 단위: {isCnt ? '개' : '만원'}</p>
      <div className="chart wk">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`요일별 ${isCnt ? '판매량' : '매출'} 막대 그래프`}>
          <line className="gl" x1={L} x2={W - R} y1={T + ih} y2={T + ih} />
          {avg.map((v, i) => {
            const cx = L + bw * i + bw / 2,
              x0 = cx - w / 2,
              base = T + ih
            let bar: ReactNode
            if (v == null)
              bar = (
                <text className="bv off" x={f1(cx)} y={base - 8} textAnchor="middle">
                  {(S.settings.offDays || []).includes(order[i]) ? '휴무' : '기록 없음'}
                </text>
              )
            else {
              const h = Math.max(10, (v / mx) * ih),
                top = base - h,
                r = Math.min(9, h / 2)
              bar = (
                <>
                  <path
                    className={`rb${i === bi ? ' best' : ''}`}
                    d={`M${f1(x0)},${base} V${f1(top + r)} Q${f1(x0)},${f1(top)} ${f1(x0 + r)},${f1(top)} H${f1(x0 + w - r)} Q${f1(x0 + w)},${f1(top)} ${f1(x0 + w)},${f1(top + r)} V${base} Z`}
                  >
                    <title>{`${WD[order[i]]}요일 평균 ${isCnt ? Math.round(v) + '개' : won(v)}`}</title>
                  </path>
                  <text className={`bv num${i === bi ? ' bvb' : ''}`} x={f1(cx)} y={f1(top - 7)} textAnchor="middle">
                    {isCnt ? Math.round(v) : manN(v)}
                  </text>
                </>
              )
            }
            return (
              <g key={i}>
                {bar}
                <text className={`ax wk-x${i === bi ? ' now' : ''}`} x={f1(cx)} y={H - 7} textAnchor="middle">
                  {WD[order[i]]}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </>
  )
}
