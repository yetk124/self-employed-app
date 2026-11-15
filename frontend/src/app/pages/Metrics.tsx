import { useState } from 'react'
import { CardHead, PageTitle } from '../components/bits'
import { MxChart, MxLegend } from '../components/charts'
import Icon from '../components/Icon'
import { aovOf, bepInfo, mxBuckets, mxRange, mxSum, tablesN, turnOf, type MxSum, type Period } from '../lib/calc'
import { keysFrom, now } from '../lib/date'
import { manN, won } from '../lib/format'
import { useStore } from '../state/store'
import { useUi } from '../state/ui'

const SLOT = { lunch: [11, 14, '점심 11–14시'], dinner: [17, 21, '저녁 17–21시'] } as const

/** 지표: 매출총이익·원가율·인기 메뉴·BEP·회전율·객단가·비용 비율 (분석 팀원 지표 SQL과 연결 예정) */
export default function Metrics() {
  const S = useStore()
  const { gate } = useUi()
  const [per, setPer] = useState<Period>('w')
  const [open, setOpen] = useState(false)
  const [slotK, setSlotK] = useState<'lunch' | 'dinner' | 'custom'>('lunch')
  const [sa, setSa] = useState('15:00')
  const [sb, setSb] = useState('17:00')
  const [amt, setAmt] = useState(false)

  const R = mxRange(per),
    cur = mxSum(S, R.cur, per === 'm'),
    prev = mxSum(S, R.prev, per === 'm'),
    B = mxBuckets(per),
    bs = B.map((b) => (b.future ? null : mxSum(S, b.keys))),
    bep = bepInfo(S)
  const val = (f: (s: MxSum) => number) => bs.map((s) => (s && s.cnt ? f(s) : null))
  const bepB = bep.perDay ? (per === 'm' ? bep.month : bep.perDay) : null
  const gpr = cur.net > 0 ? (cur.gp / cur.net) * 100 : null
  const top = Object.entries(cur.per)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => ({ m: S.menus.find((x) => x.id === id), n }))
    .filter((x) => x.m)
  const slot: [number, number, string] =
    slotK === 'custom' ? [+sa.split(':')[0], +sb.split(':')[0], `${sa}–${sb}`] : [SLOT[slotK][0], SLOT[slotK][1], SLOT[slotK][2]]
  const turn = (s: MxSum) => turnOf(S, s, [slot[0], slot[1]])

  // 비용 비율: 최근 3개월 + 이번 달, 순매출 = 100%
  const t = now(),
    td = new Date(t.getFullYear(), t.getMonth(), t.getDate())
  const mons = [-3, -2, -1, 0].map((dm) => {
    const s = new Date(t.getFullYear(), t.getMonth() + dm, 1),
      e = new Date(s.getFullYear(), s.getMonth() + 1, 0)
    return { lbl: dm ? `${s.getMonth() + 1}월` : '이번 달', s: mxSum(S, keysFrom(s, e < td ? e : td), true) }
  })
  const parts = (s: MxSum): [string, string, number | null, number][] => {
    const n = s.net || 0,
      p = (v: number) => (n > 0 ? Math.max(0, (v / n) * 100) : 0)
    return [
      ['k1', '원가 (식자재)', s.cogs, p(s.cogs)],
      ['k2', '인건비', null, 0],
      ['k3', '고정비', s.fixed, p(s.fixed)],
      ['k4', '수수료·포장비', s.fee, p(s.fee)],
      ['k5', '남는 이익', s.profit, p(s.profit)],
    ]
  }
  const maxNet = Math.max(1, ...mons.map((x) => x.s.net))
  const cp = parts(cur)
  const costRate = (() => {
    const a = cur.net > 0 ? (cur.cogs / cur.net) * 100 : null,
      b = prev.net > 0 ? (prev.cogs / prev.net) * 100 : null
    if (a == null || b == null) return <span className="k2-s">비교할 기간 기록 없음</span>
    const d = a - b
    return (
      <>
        <span className={`wk-d ${d <= 0 ? 'down' : 'up'} num`}>
          {d <= 0 ? '↓' : '↑'} {Math.abs(d).toFixed(1)}%p
        </span>
        <span className="k2-s">{R.pl} 대비</span>
      </>
    )
  })()
  const pctTxt = (c: number, p: number) => {
    if (!(p > 0)) return <span className="k2-s">비교할 기간 기록 없음</span>
    const v = Math.round(((c - p) / p) * 100)
    return (
      <span className={`wk-d ${v >= 0 ? 'up' : 'down'} num`}>
        {v >= 0 ? '↑' : '↓'} {Math.abs(v)}%
      </span>
    )
  }
  const est = (title: string) => (
    <span className="mx-est" title={title}>
      추정
    </span>
  )

  return (
    <>
      <PageTitle>지표</PageTitle>
      <div className="seg2 mx-per" role="tablist" aria-label="기간">
        {(
          [
            ['d', '일'],
            ['w', '주'],
            ['m', '월'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={per === k} onClick={() => setPer(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="hstack">
        <p className="c2-lead mx-lead num">
          {R.label} · {R.cur[0].slice(5).replace('-', '.')}
          {R.cur.length > 1 ? ' – ' + R.cur[R.cur.length - 1].slice(5).replace('-', '.') : ''} 기준
        </p>
        <div className="k2">
          <div className="k2-c blue">
            <span className="k2-i">
              <Icon name="coin" />
            </span>
            <span className="k2-m">
              <span className="k2-l">매출총이익</span>
              <b className="k2-v num">
                {manN(cur.gp)}
                <small>만원</small>
              </b>
              <span className="k2-d">
                {pctTxt(cur.gp, prev.gp)}
                <span className="k2-s">이익률 {gpr == null ? '–' : gpr.toFixed(1) + '%'}</span>
              </span>
            </span>
          </div>
          <div className="k2-c pink">
            <span className="k2-i">
              <Icon name="pie" />
            </span>
            <span className="k2-m">
              <span className="k2-l">원가율</span>
              <b className="k2-v num">
                {cur.net > 0 ? ((cur.cogs / cur.net) * 100).toFixed(1) : '–'}
                <small>%</small>
              </b>
              <span className="k2-d">{costRate}</span>
            </span>
          </div>
        </div>

        <section className="hcard" aria-labelledby="mx-top3">
          <div className="hc-h">
            <h2 id="mx-top3">인기 메뉴</h2>
            <span className="k2-s">{R.label} · 판매량 기준</span>
          </div>
          {top.length ? (
            <ol className="mx-top">
              {top.map((x, i) => (
                <li key={x.m!.id}>
                  <span className={`mx-rk r${i}`}>{i + 1}</span>
                  <span className="grow">{x.m!.name}</span>
                  <b className="num">{x.n}건</b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="hint">이 기간에 판매가 없어요.</p>
          )}
        </section>

        <section className="hcard" aria-labelledby="mx-np">
          <div className="hc-h">
            <h2 id="mx-np">순매출 · 매출총이익</h2>
          </div>
          <div className="mx-2">
            <div>
              <small>순매출</small>
              <b className="num">{won(cur.net)}</b>
            </div>
            <div>
              <small>매출총이익</small>
              <b className="num mx-blue">{won(cur.gp)}</b>
            </div>
          </div>
          <MxLegend
            items={[
              ['c0', '순매출'],
              ['c2', '매출총이익'],
              ['bep', '손익분기점 (BEP)'],
            ]}
          />
          <MxChart
            B={B}
            lines={[
              { name: '순매출', cls: 'c0', vals: val((s) => s.net) },
              { name: '매출총이익', cls: 'c2', vals: val((s) => s.gp) },
            ]}
            bep={bepB}
            label="순매출과 매출총이익 추이, 손익분기점 점선"
          />
          <p className="c2-foot">
            순매출 = 총매출 − 할인 − 환불 · 매출총이익 = 순매출 − 식자재 원가 · BEP는 {per === 'm' ? '한 달' : '하루'} 기준으로 나눈 값
          </p>
          <button className="mx-fold" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mx-det">
            매출 상세 · 총매출 / 할인 / 환불{' '}
            <span className="mx-chev">
              <Icon name="chev" />
            </span>
          </button>
          <div id="mx-det" hidden={!open}>
            <div className="mx-3">
              <div>
                <small>총매출</small>
                <b className="num">{won(cur.gross)}</b>
              </div>
              <div>
                <small>할인 금액</small>
                <b className="num">{won(cur.disc)}</b>
              </div>
              <div>
                <small>환불 금액</small>
                <b className="num">{won(cur.ref)}</b>
              </div>
            </div>
            <p className="c2-foot num">
              할인율 {cur.gross ? ((cur.disc / cur.gross) * 100).toFixed(1) : '0'}% · 환불율 {cur.gross ? ((cur.ref / cur.gross) * 100).toFixed(1) : '0'}% (각 금액 ÷ 총매출)
            </p>
            <h3 className="mx-h3">총매출 추이</h3>
            <MxChart B={B} lines={[{ name: '총매출', cls: 'c0', vals: val((s) => s.gross) }]} label="총매출 추이" h={130} />
            <div className="mx-h3row">
              <h3 className="mx-h3">할인·환불 추이</h3>
              <MxLegend
                items={[
                  ['c1', '할인'],
                  ['c3', '환불'],
                ]}
              />
            </div>
            <MxChart
              B={B}
              lines={[
                { name: '할인', cls: 'c1', vals: val((s) => s.disc) },
                { name: '환불', cls: 'c3 dash', vals: val((s) => s.ref) },
              ]}
              label="할인·환불 추이"
              h={120}
            />
            {!(cur.disc + cur.ref) && <p className="c2-foot">할인·환불은 판매 입력 창 맨 아래에서 넣을 수 있어요.</p>}
          </div>
        </section>

        <section className="hcard" aria-labelledby="mx-bep" id="mx-bep-sec">
          <div className="hc-h">
            <h2 id="mx-bep">손익분기점</h2>
            {bep.month && (
              <b className="mx-big num">
                {manN(bep.month)}
                <small>만원</small>
              </b>
            )}
          </div>
          {bep.month && bep.rate != null ? (
            <>
              <p className="c2-sub">
                이번 달 <b className="num">{Math.round(bep.rate * 100)}%</b> 달성 · 누적 순매출 {manN(bep.mtd)}만원
              </p>
              <div
                className="mx-prog"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.round(bep.rate * 100))}
                aria-label="손익분기점 달성률"
              >
                <i style={{ width: `${Math.min(100, bep.rate * 100).toFixed(1)}%` }} />
              </div>
              <p className="c2-foot num">
                한 달 고정비 {won(bep.fixed)}
                {bep.fixEst ? ' (이번 달 입력 전이라 지난달 값)' : ''} ÷ 공헌이익률 {(bep.cm * 100).toFixed(1)}% · 공헌이익률 = (순매출 − 원가·수수료) ÷ 순매출, 최근 30일 실제 값
              </p>
            </>
          ) : (
            <>
              <p className="hint">
                {bep.fixed ? '최근 30일 판매로는 공헌이익률이 0% 이하라 계산할 수 없어요.' : '고정비를 입력하면 이번 달에 얼마를 팔아야 본전인지 알려 드려요.'}
              </p>
              {!bep.fixed && (
                <button className="btn" onClick={() => gate({ kind: 'fixed' })}>
                  고정비 입력
                </button>
              )}
            </>
          )}
        </section>

        <section className="hcard" aria-labelledby="mx-turn">
          <div className="hc-h">
            <h2 id="mx-turn">테이블 회전율 {est('시간별 판매 기록이 없어서 홀 메뉴 2개 = 테이블 이용 1건, 시간대 비중은 일반 식당 분포로 추정했어요.')}</h2>
            <b className="mx-big num">
              {turn(cur).toFixed(1)}
              <small>회</small>
            </b>
          </div>
          <div className="row mx-slot">
            {(
              [
                ['lunch', '점심시간'],
                ['dinner', '저녁시간'],
                ['custom', '직접 설정'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} className="chip" aria-pressed={slotK === k} onClick={() => setSlotK(k)}>
                {l}
              </button>
            ))}
          </div>
          {slotK === 'custom' && (
            <div className="grid2 mx-time">
              <label className="field">
                <span>시작</span>
                <input className="inp num" type="time" step="3600" value={sa} onChange={(e) => setSa(e.target.value)} name="mx-sa" autoComplete="off" />
              </label>
              <label className="field">
                <span>종료</span>
                <input className="inp num" type="time" step="3600" value={sb} onChange={(e) => setSb(e.target.value)} name="mx-sb" autoComplete="off" />
              </label>
            </div>
          )}
          <MxChart
            B={B}
            lines={[{ name: '회전율', cls: 'c2', vals: val((s) => +turn(s).toFixed(2)) }]}
            label={`${slot[2]} 테이블 회전율 추이`}
            h={130}
            fmt={(v, st) => v.toFixed(st < 0.1 ? 2 : 1)}
            tipFmt={(v) => v.toFixed(2) + '회'}
          />
          <p className="c2-foot num">
            {slot[2]} 하루 평균 · 홀 이용 건수 ÷ 테이블 {tablesN(S)}개 (테이블 수는 관리 → 고정비에서 바꿔요)
          </p>
        </section>

        <section className="hcard" aria-labelledby="mx-aov">
          <div className="hc-h">
            <h2 id="mx-aov">객단가 {est('방문 고객 수 기록이 없어서 판매한 메뉴 수를 고객 수로 가정했어요.')}</h2>
            <b className="mx-big num">{won(aovOf(cur))}</b>
          </div>
          <MxChart B={B} lines={[{ name: '객단가', cls: 'c0', vals: val((s) => Math.round(aovOf(s))) }]} label="객단가 추이" h={130} />
          <p className="c2-foot">객단가 = 순매출 ÷ 방문 고객 수. 주문 1건당 금액과는 다른 지표예요.</p>
        </section>

        <section className="hcard" aria-labelledby="mx-cost">
          <CardHead
            icon="pie"
            title="매출 대비 비용 비율"
            id="mx-cost"
            right={
              <div className="seg2" role="tablist" aria-label="보기">
                <button role="tab" aria-selected={!amt} onClick={() => setAmt(false)}>
                  비율
                </button>
                <button role="tab" aria-selected={amt} onClick={() => setAmt(true)}>
                  금액
                </button>
              </div>
            }
          />
          <p className="c2-unit">{amt ? '최근 4개월 · 막대 높이 = 순매출 · 단위: 만원' : '최근 4개월 · 순매출 100% 기준 · 숫자: 남는 이익'}</p>
          <div className="mx-sbs">
            {mons.map(({ lbl, s }, i) => {
              const ps = parts(s),
                tot = ps.reduce((a, p) => a + p[3], 0) || 1,
                h = amt ? Math.max(4, (s.net / maxNet) * 100) : 100,
                pr = s.net > 0 ? Math.round((s.profit / s.net) * 100) : null
              return (
                <div key={lbl} className={'mx-sb' + (i === mons.length - 1 ? ' now' : '')}>
                  <span className="mx-sv num">{amt ? manN(s.net) : pr == null ? '–' : pr + '%'}</span>
                  <div className="mx-sbar" style={{ height: `${h.toFixed(1)}%` }} title={`${lbl} 순매출 ${won(s.net)} · 남는 이익 ${pr == null ? '–' : pr + '%'}`}>
                    {s.net > 0 && ps.filter((p) => p[3] > 0).map((p) => <i key={p[0]} className={p[0]} style={{ flex: +(p[3] / tot).toFixed(4) }} />)}
                  </div>
                  <small>{lbl}</small>
                </div>
              )
            })}
          </div>
          <div className="mx-dl">
            {cp.map((p) => (
              <span key={p[0]}>
                <i className={p[0]} />
                {p[1]}
              </span>
            ))}
          </div>
          <ul className="mx-cl">
            {cp.map((p) => (
              <li key={p[0]} className={p[0] === 'k5' ? 'on' : ''}>
                <i className={p[0]} />
                <span>{p[1]}</span>
                <b className="num">{p[2] == null ? '미입력' : (p[2] < 0 ? '−' : '') + won(Math.abs(p[2]))}</b>
                <small className="num">{p[2] == null ? '–' : (cur.net > 0 ? ((p[2] / cur.net) * 100).toFixed(0) : '0') + '%'}</small>
              </li>
            ))}
          </ul>
          <p className="c2-foot">
            {R.label} 기준 · 고정비는 {per === 'm' ? '낸 날 전액 반영 (홈과 같은 기준)' : '한 달 고정비를 지난 날수만큼 나눠 반영'}
            {cur.fixEst ? ' (이번 달 입력 전이라 지난달 값)' : ''} · 인건비는 아직 입력 기능이 없어요.
          </p>
        </section>
      </div>
    </>
  )
}
