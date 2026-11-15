import Icon from '../../components/Icon'
import { todayKey } from '../../lib/date'
import { won } from '../../lib/format'
import { store, useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import type { FixedCost } from '../../types'

/** 고정비: 가게 규모(테이블 수) + 달별 고정비 목록 */
export default function FixedTab() {
  const S = useStore()
  const { gate } = useUi()
  const mo = todayKey().slice(0, 7),
    list = S.fixed.slice().sort((a, b) => (a.date < b.date ? 1 : -1))
  const groups: Record<string, FixedCost[]> = {}
  list.forEach((f) => (groups[f.date.slice(0, 7)] ??= []).push(f))
  const curTot = (groups[mo] ?? []).reduce((a, f) => a + (+f.amount || 0), 0),
    tables = +(S.settings.tables ?? 0) || 0
  const per = tables ? Math.round(curTot / tables) : 0
  return (
    <>
      <p className="desc">
        월세·관리비처럼 매달 나가는 돈이에요.
        <br />
        장부의 지출과 홈의 이번 달 이익에 반영돼요.
      </p>
      <section className="hcard fx-size" aria-labelledby="h-size">
        <div className="fx-row">
          <div>
            <h2 id="h-size" className="fx-k">
              가게 규모
            </h2>
            <span className="fx-s">테이블 수를 넣으면 테이블당 고정비를 계산해요</span>
          </div>
          <label className="fx-in">
            <input
              autoComplete="off"
              name="set-tables"
              className="inp num"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={S.settings.tables || ''}
              placeholder="0"
              aria-label="테이블 수"
              onChange={(e) =>
                store.update((s) => {
                  s.settings.tables = Math.max(0, Math.floor(+e.target.value || 0)) || ''
                })
              }
            />
            <span>개</span>
          </label>
        </div>
        <div className="fx-per">
          <span>테이블 1개당 이번 달 고정비</span>
          <b className="num">{tables ? won(per) : '–'}</b>
        </div>
      </section>
      {list.length ? (
        <>
          {Object.keys(groups)
            .sort()
            .reverse()
            .map((k) => {
              const g = groups[k],
                tot = g.reduce((a, f) => a + (+f.amount || 0), 0)
              return (
                <section key={k} className="fx-grp">
                  <div className="fx-gh">
                    <span>
                      {+k.slice(5)}월{k === mo ? ' (이번 달)' : ''}
                    </span>
                    <b className="num">{won(tot)}</b>
                  </div>
                  <div className="hcard fx-list">
                    {g.map((f) => (
                      <button key={f.id} className="tx" onClick={() => gate({ kind: 'fixed', id: f.id })}>
                        <span className="tx-i tx-fix">
                          <Icon name="bill" />
                        </span>
                        <span className="tx-m">
                          <span className="tx-t">{f.name}</span>
                          <span className="tx-s num">
                            {+f.date.slice(5, 7)}. {+f.date.slice(8)}. 냄
                          </span>
                        </span>
                        <span className="tx-a num">{won(+f.amount)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
          <button className="btn block fx-add" onClick={() => gate({ kind: 'fixed' })}>
            <Icon name="plus" width={18} height={18} style={{ verticalAlign: -3, marginRight: 4 }} />
            고정비 추가
          </button>
        </>
      ) : (
        <div className="note">
          <p className="note-t">아직 등록한 고정비가 없어요</p>
          <p className="note-b">월세, 관리비, 전기세처럼 매달 나가는 돈을 넣어 보세요.</p>
          <button className="note-a" onClick={() => gate({ kind: 'fixed' })}>
            고정비 추가
          </button>
        </div>
      )}
    </>
  )
}
