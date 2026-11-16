import Sheet from '../components/Sheet'
import { dayStats, menuAt } from '../lib/calc'
import { todayKey } from '../lib/date'
import { won } from '../lib/format'
import { store, useStore } from '../state/store'
import { useUi } from '../state/ui'

/**
 * 하루 판매 입력: 메뉴별 − / + 로 1분 입력, 할인·환불.
 * 서버가 붙으면 "입력 완료"에서 PUT /api/sales/{date} (그날 판매가·원가 스냅샷 포함)
 */
export default function SalesSheet() {
  const S = useStore()
  const { sel, ch: chSel, setCh, close } = useUi()
  const ch = S.channels.some((c) => c.id === chSel) ? chSel : S.channels[0]?.id
  const [, m, d] = sel.split('-').map(Number)
  const day = S.sales[sel] ?? {}
  const adj = S.adj[sel] ?? { disc: 0, ref: 0 }
  const st = dayStats(S, sel)

  const cnt = (mid: string, n: number) =>
    store.update((s) => {
      const dd = (s.sales[sel] ??= {}),
        mm = (dd[mid] ??= {})
      mm[ch] = Math.max(0, (mm[ch] || 0) + n)
    })
  const setAdj = (k: 'disc' | 'ref', v: string) =>
    store.update((s) => {
      const a = (s.adj[sel] ??= { disc: 0, ref: 0 })
      a[k] = Math.max(0, +v || 0)
      if (!a.disc && !a.ref) delete s.adj[sel]
    })

  return (
    <Sheet
      title={`${m}월 ${d}일 판매 입력`}
      foot={
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="label">{sel === todayKey() ? '오늘' : '이날'} 이익</div>
            <div
              className="num"
              style={{
                fontSize: 'var(--hwp-font-headline-5)',
                fontWeight: 700,
                color: st.profit < 0 ? 'var(--hwp-color-brand)' : 'var(--hwp-color-foreground)',
              }}
            >
              {won(st.profit)}
            </div>
          </div>
          <button className="btn primary" onClick={close}>
            입력 완료
          </button>
        </>
      }
    >
      <div className="sl-ch">
        <div
          className="seg2"
          role="tablist"
          aria-label="판매 채널"
          style={{ gridTemplateColumns: `repeat(${S.channels.length},1fr)` }}
        >
          {S.channels.map((c) => {
            const n = Object.values(day).reduce((a, x) => a + (+x[c.id] || 0), 0)
            return (
              <button key={c.id} role="tab" aria-selected={ch === c.id} onClick={() => setCh(c.id)}>
                {c.name}
                <span className="num">{n}</span>
              </button>
            )
          })}
        </div>
      </div>
      <ul className="list sl-list">
        {S.menus.map((mn) => {
          const n = (day[mn.id] ?? {})[ch] || 0,
            tot = Object.values(day[mn.id] ?? {}).reduce((a, b) => a + (+b || 0), 0)
          return (
            <li key={mn.id} className={'li' + (n ? ' on' : '')}>
              <div className="grow">
                <div className="t">{mn.name}</div>
                <div className="s num">
                  {won(menuAt(mn, sel).price)} · 전체 {tot}개
                </div>
              </div>
              <div className="step">
                <button onClick={() => cnt(mn.id, -1)} aria-label={`${mn.name} 빼기`}>
                  −
                </button>
                <output className="num">{n}</output>
                <button className="plus" onClick={() => cnt(mn.id, 1)} aria-label={`${mn.name} 더하기`}>
                  +
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="adj">
        <div className="adj-h">
          <b>할인·환불</b>
          <small>이날 전체 금액 · 없으면 비워 두세요</small>
        </div>
        <div className="grid2">
          <label className="field">
            <span>할인 금액 (원)</span>
            <input
              autoComplete="off"
              name="adj-disc"
              className="inp num"
              type="number"
              min="0"
              step="100"
              inputMode="numeric"
              value={adj.disc || ''}
              placeholder="0"
              onChange={(e) => setAdj('disc', e.target.value)}
            />
          </label>
          <label className="field">
            <span>환불 금액 (원)</span>
            <input
              autoComplete="off"
              name="adj-ref"
              className="inp num"
              type="number"
              min="0"
              step="100"
              inputMode="numeric"
              value={adj.ref || ''}
              placeholder="0"
              onChange={(e) => setAdj('ref', e.target.value)}
            />
          </label>
        </div>
      </div>
    </Sheet>
  )
}
