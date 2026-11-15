import { useEffect, useRef, useState } from 'react'
import MonthSummary from './home/MonthSummary'
import Fab from '../components/Fab'
import { WeekCard } from '../components/charts'
import { TxRow } from '../components/bits'
import Icon from '../components/Icon'
import { alerts, insightMenu, txList } from '../lib/insights'
import { now } from '../lib/date'
import { useStore } from '../state/store'
import { useUi } from '../state/ui'

/** 홈: 월 요약 → 주간 매출 추이 → 이번 주 인사이트 → 큰 입력 버튼 → 최근 거래 */
export default function Home() {
  const S = useStore()
  const { go, open, gate, salesToday, openReceipt, openAuth } = useUi()
  const t = now()
  const [ym, setYm] = useState({ y: t.getFullYear(), m: t.getMonth() })
  const [wsel, setWsel] = useState('')
  const { y, m } = ym
  const isCur = y === t.getFullYear() && m === t.getMonth()
  const ins = insightMenu(S),
    al = alerts(S),
    tx = txList(S, y, m).slice(0, 5)

  const mon = (d: number) => {
    let mm = m + d,
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

  // 큰 입력 버튼이 화면 밖으로 나가면 + 버튼 보이기
  const cta = useRef<HTMLButtonElement>(null)
  const [fab, setFab] = useState(false)
  useEffect(() => {
    const on = () => {
      const r = cta.current?.getBoundingClientRect()
      if (r) setFab(!(r.bottom > 8 && r.top < innerHeight - 96))
    }
    on()
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [])

  return (
    <>
      <header className="h-top">
        <span className="h-l">
          <img className="h-logo" src="/img/logo.png" width="455" height="102" alt="domain" translate="no" />
          {!S.user && (
            <button className="h-pill" onClick={() => openAuth()}>
              예시 데이터 · 내 가게로 시작
            </button>
          )}
        </span>
        <span className="h-r">
          <button className="iconbtn bell" onClick={() => go('/metrics')} aria-label="지표 보기" title="지표 보기">
            <Icon name="chart" />
          </button>
          <button className="iconbtn bell" onClick={() => open({ kind: 'bell' })} aria-label={'알림' + (al.length ? ' ' + al.length + '개' : '')}>
            <Icon name="bell" />
            {al.length > 0 && <span className="bd" />}
          </button>
        </span>
      </header>
      <div className="mon">
        <button className="iconbtn" onClick={() => mon(-1)} aria-label="이전 달">
          <Icon name="l" />
        </button>
        <b className="num">
          {y}. {m + 1}.
        </b>
        <button className="iconbtn" onClick={() => mon(1)} aria-label="다음 달" disabled={isCur}>
          <Icon name="r" />
        </button>
      </div>
      <div className="hstack">
        <MonthSummary S={S} y={y} m={m} />

        <section className="hcard" aria-labelledby="h-trend">
          <WeekCard S={S} y={y} m={m} wsel={wsel} onSel={setWsel} onMore={() => go('/metrics')} />
        </section>

        <section className="hcard ai2" aria-labelledby="h-ai">
          <button className="ai2-b" onClick={() => ('sales' in ins.act ? salesToday() : go(ins.act.go))}>
            <span className="ai2-top">
              <span className="ai2-chip" id="h-ai">
                <Icon name="spark" />
                이번 주 인사이트
              </span>
              <span className="ai2-go">
                <Icon name="chev" />
              </span>
            </span>
            <span className="ai2-mid">
              <span className="ai2-tx">
                <span className="ai2-k">{ins.k}</span>
                <span className="ai2-main">{ins.main}</span>
              </span>
              <span className="ai2-av">
                <img src={ins.img} width="161" height="205" alt="" />
              </span>
            </span>
            {ins.stats.length > 0 && (
              <span className="ai2-stats">
                {ins.stats.map(([l, v]) => (
                  <span key={l}>
                    <small>{l}</small>
                    <b className="num">{v}</b>
                  </span>
                ))}
              </span>
            )}
            <span className="ai2-note">{ins.note}</span>
          </button>
        </section>

        <div className="cta-wrap">
          <button className="cta-big" id="cta-big" ref={cta} onClick={salesToday}>
            <span className="cb-i">
              <Icon name="bars" />
            </span>
            <span className="grow">오늘 매출 입력하기</span>
            <Icon name="chev" />
          </button>
          <div className="cta2">
            <button onClick={() => gate({ kind: 'fixed' })}>
              <span className="c2-i">
                <Icon name="doc" />
              </span>
              <span className="grow">고정비 입력</span>
              <Icon name="chev" />
            </button>
            <button onClick={openReceipt}>
              <span className="c2-i buy">
                <Icon name="box" />
              </span>
              <span className="grow">매입 입력</span>
              <Icon name="chev" />
            </button>
          </div>
        </div>

        <section className="hcard" aria-labelledby="h-tx">
          <div className="hc-h">
            <h2 id="h-tx">최근 거래 내역</h2>
            {tx.length > 0 && (
              <button className="more" onClick={() => go('/ledger#sec-mtx')}>
                전체보기 <Icon name="chev" />
              </button>
            )}
          </div>
          {tx.length ? (
            <div className="txs">
              {tx.map((x) => (
                <TxRow key={x.kind + (x.id ?? x.date)} x={x} />
              ))}
            </div>
          ) : (
            <p className="hint" style={{ margin: '4px 0' }}>
              이 달의 거래가 없어요.
            </p>
          )}
        </section>
      </div>
      <Fab show={fab} onClick={salesToday} />
    </>
  )
}
