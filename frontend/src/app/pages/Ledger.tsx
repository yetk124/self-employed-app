import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { CardHead, PageTitle, PctPill, TxRow } from '../components/bits'
import { MonthCompare, WdBars } from '../components/charts'
import Icon from '../components/Icon'
import { dayStats, goalOf, isOffDay, monthSum, rangeSum } from '../lib/calc'
import { dimOf, ds, now, todayKey, WD } from '../lib/date'
import { cmpN, manN, won } from '../lib/format'
import { monthTip, txList } from '../lib/insights'
import { useStore } from '../state/store'
import { useUi } from '../state/ui'

/** 장부: 달력(일별 매출·지출) + 월 예상 매출 + 요일별 매출 + 한 줄 분석 + 거래 내역 */
export default function Ledger() {
  const S = useStore()
  const { sel, setSel, open, go } = useUi()
  const [params] = useSearchParams()
  const t = now()
  // 거래 내역에서 날짜를 눌러 들어오면(?d=YYYY-MM-DD) 그 달부터 보여줌
  const [ym, setYm] = useState(() => {
    const d = params.get('d')
    if (!d) return { y: t.getFullYear(), m: t.getMonth() }
    const [py, pm] = d.split('-').map(Number)
    return { y: py, m: pm - 1 }
  })
  const [wdm, setWdm] = useState<'rev' | 'cnt'>('rev')

  const { y, m } = ym
  const first = new Date(y, m, 1).getDay(),
    days = dimOf(y, m),
    today = todayKey(),
    G = goalOf(S),
    isCur = y === t.getFullYear() && m === t.getMonth()
  const mon = (dd: number) => {
    let mm = m + dd,
      yy = y
    if (mm < 0) {
      mm = 11
      yy--
    }
    if (mm > 11) {
      mm = 0
      yy++
    }
    setYm({ y: yy, m: mm })
  }

  let openN = 0,
    wins = 0
  const cells = []
  for (let i = 0; i < first; i++) cells.push(<div key={'e' + i} />)
  for (let dd = 1; dd <= days; dd++) {
    const key = ds(y, m, dd),
      st = dayStats(S, key),
      fut = key > today
    if (st.cnt) {
      openN++
      if (st.rev >= G) wins++
    }
    const fx = S.fixed.filter((f) => f.date === key).reduce((a, f) => a + (+f.amount || 0), 0),
      sp = fut ? 0 : st.cost + st.fee + fx
    const off = !st.cnt && isOffDay(S, key)
    const cls = ['day cday', fut && 'future', key === today && 'today', key === sel && 'sel', st.cnt && 'has', off && 'off'].filter(Boolean).join(' ')
    cells.push(
      <button
        key={key}
        className={cls}
        onClick={() => {
          setSel(key)
          open({ kind: 'day', date: key })
        }}
        aria-label={`${m + 1}월 ${dd}일${off ? ', 휴무' : ''}${st.cnt ? ', 매출 ' + won(st.rev) : ''}${sp ? ', 지출 ' + won(sp) : ''}`}
      >
        <span className="n num">{dd}</span>
        <span className="cv in num">{st.cnt ? '+' + cmpN(st.rev) : off ? <span className="offt">휴무</span> : ''}</span>
        <span className="cv out num">{sp ? '−' + cmpN(sp) : ''}</span>
      </button>,
    )
  }

  const upto = isCur ? t.getDate() : days,
    pmD = new Date(y, m - 1, 1)
  const c = rangeSum(S, y, m, 1, upto),
    p = rangeSum(S, pmD.getFullYear(), pmD.getMonth(), 1, Math.min(upto, dimOf(pmD.getFullYear(), pmD.getMonth())))
  const all = txList(S, y, m)
  const ms = monthSum(S, y, m, null)
  const tip = monthTip(S)

  return (
    <>
      <PageTitle
        right={
          <div className="mnav">
            <button className="iconbtn" onClick={() => mon(-1)} aria-label="이전 달">
              <Icon name="l" />
            </button>
            <b className="mnav-t num">
              {y}. {m + 1}.
            </b>
            <button className="iconbtn" onClick={() => mon(1)} aria-label="다음 달">
              <Icon name="r" />
            </button>
          </div>
        }
      >
        장부
      </PageTitle>
      <p className="c2-lead">{isCur ? `${m + 1}월 1일부터 오늘까지` : `${m + 1}월 한 달`} 우리 가게 현황</p>
      <div className="hstack">
        <div className="k2">
          <div className="k2-c pink">
            <span className="k2-i">
              <Icon name="bag" />
            </span>
            <span className="k2-m">
              <span className="k2-l">총 판매량</span>
              <b className="k2-v num">
                {c.cnt.toLocaleString('ko-KR')}
                <small>개</small>
              </b>
              <span className="k2-d">
                <PctPill c={c.cnt} p={p.cnt} suffix="지난달 대비" />
              </span>
            </span>
          </div>
          <div className="k2-c blue">
            <span className="k2-i">
              <Icon name="coin" />
            </span>
            <span className="k2-m">
              <span className="k2-l">총 매출</span>
              <b className="k2-v num">
                {manN(c.rev)}
                <small>만원</small>
              </b>
              <span className="k2-d">
                <PctPill c={c.rev} p={p.rev} suffix="지난달 대비" />
              </span>
            </span>
          </div>
        </div>

        <section className="hcard" aria-labelledby="h-cal">
          <h2 className="sr" id="h-cal">
            {m + 1}월 달력
          </h2>
          <button className="csum" onClick={() => document.getElementById('sec-mtx')?.scrollIntoView({ block: 'start' })}>
            <dl>
              <div>
                <dt>매출</dt>
                <dd className="in num">{won(ms.rev)}</dd>
              </div>
              <div>
                <dt>지출</dt>
                <dd className="num">{won(ms.spend)}</dd>
              </div>
            </dl>
            <span className="csum-c">
              <Icon name="chev" />
            </span>
          </button>
          <div className="cal ccal">
            {WD.map((w) => (
              <div key={w} className="wd">
                {w}
              </div>
            ))}
            {cells}
          </div>
          <p className="c2-foot">
            목표 {won(G)} 달성{' '}
            <b className="num" style={{ color: 'var(--win)' }}>
              {wins}일
            </b>{' '}
            / 영업 {openN}일
          </p>
        </section>

        <section className="hcard" aria-labelledby="h-mc">
          <MonthCompare S={S} y={y} m={m} />
        </section>
        <section className="hcard" aria-labelledby="h-wd">
          <WdBars S={S} mode={wdm} onMode={setWdm} />
        </section>
        <button className="h-bep mx-link hcard" onClick={() => go('/metrics')}>
          <span className="grow">
            <span className="t">
              <b>매출 흐름·비용 비율</b>은 지표에서 볼 수 있어요
            </span>
          </span>
          <Icon name="chev" />
        </button>

        <div className="tip2 static">
          <span className="tip2-i">
            <Icon name="bulb" />
          </span>
          <span className="tip2-m">
            <b>{isCur ? '이번 달' : `${m + 1}월`} 한 줄 분석</b>
            <span>
              {tip ? (
                <>
                  <b>{tip.best}요일</b> 매출이 가장 높고, <b>{tip.worst}요일</b>이 가장 낮아요. {tip.worst}요일엔 점심 세트처럼 손님을 부르는 메뉴를 고민해 보세요.
                </>
              ) : (
                '판매를 입력하면 우리 가게 흐름을 분석해 드려요.'
              )}
            </span>
          </span>
        </div>

        <section className="hcard" id="sec-mtx" aria-labelledby="h-mtx">
          <CardHead icon="doc" title={`${m + 1}월 거래 내역`} right={<span className="hint-r num">{all.length}건</span>} id="h-mtx" />
          {all.length ? (
            <>
              <div className="txs">
                {all.slice(0, 12).map((x) => (
                  <TxRow key={x.kind + (x.id ?? x.date)} x={x} />
                ))}
              </div>
              {all.length > 12 && (
                <button className="btn block" style={{ marginTop: 10 }} onClick={() => open({ kind: 'txAll', y, m })}>
                  전체 {all.length}건 보기
                </button>
              )}
            </>
          ) : (
            <p className="hint">이 달의 거래가 없어요.</p>
          )}
        </section>
      </div>
    </>
  )
}
