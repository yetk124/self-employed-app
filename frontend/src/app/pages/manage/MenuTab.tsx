import { toast } from '@/shared/toast'
import { Thumb } from '../../components/bits'
import { chMargin, menuCost } from '../../lib/calc'
import { won } from '../../lib/format'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'

/** 메뉴별 실제 마진: 판매가 − 원가 − 채널 수수료 */
export default function MenuTab() {
  const S = useStore()
  const { gate } = useUi()
  const warn = S.menus.filter((m) => m.price && menuCost(S, m) / m.price >= 0.4).length
  const edit = (id: string) => {
    if (!S.ings.length) return toast('식자재를 먼저 등록하세요.')
    gate({ kind: 'menu', id })
  }
  return (
    <>
      <p className="desc">
        판매가에서 원가와 수수료를 빼고
        <br />
        1개 팔 때 실제로 남는 돈이에요.
      </p>
      {warn > 0 && (
        <div className="banner">
          <span className="dot" style={{ marginTop: 7 }} />
          <div>
            <b>원가율 40% 이상 메뉴 {warn}개</b>
            <br />
            가격이나 레시피 양을 점검해 보세요.
          </div>
        </div>
      )}
      <ul className="list">
        {S.menus.length ? (
          S.menus.map((m) => {
            const c = menuCost(S, m),
              rate = m.price ? (c / m.price) * 100 : 0
            return (
              <li key={m.id}>
                <button className="li" onClick={() => edit(m.id)}>
                  <Thumb o={m} kind="menu" />
                  <div className="grow">
                    <div className="row">
                      <span className="t">{m.name}</span>
                      <span className={'pill num' + (rate >= 40 ? ' warn' : '')}>원가율 {rate.toFixed(1)}%</span>
                    </div>
                    <div className="s num">
                      {won(m.price)} · 원가 {won(c)}
                    </div>
                    <div className="margins num">
                      {S.channels.map((ch) => (
                        <span key={ch.id}>
                          {ch.name} <b>{won(chMargin(S, m, ch))}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              </li>
            )
          })
        ) : (
          <li className="empty">메뉴가 없어요. 오른쪽 위 + 로 추가하세요.</li>
        )}
      </ul>
    </>
  )
}
