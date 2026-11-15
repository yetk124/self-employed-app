import { Thumb } from '../../components/bits'
import Icon from '../../components/Icon'
import { unitPrice } from '../../lib/calc'
import { fmtUnit, won } from '../../lib/format'
import { useStore } from '../../state/store'
import { useUi } from '../../state/ui'

const SRC = { server: '서버 인식', device: '기기 인식', text: '글자 입력' } as const

/** 식자재 단가 목록 + 영수증 인식 진입 + 최근 영수증 */
export default function IngTab() {
  const S = useStore()
  const { gate, openReceipt } = useUi()
  const f = S.receipts.reduce((a, r) => a + (r.fields || 0), 0),
    ed = S.receipts.reduce((a, r) => a + (r.edited || 0), 0)
  return (
    <>
      <p className="desc">
        산 가격과 양을 넣으면 단위당 가격이 나와요.
        <br />
        가격이 오르면 바뀐 메뉴를 알려 드려요.
      </p>
      <button className="banner rc-banner" onClick={openReceipt}>
        <span style={{ color: 'var(--hwp-color-foreground)', flex: 'none' }}>
          <Icon name="receipt" width={22} height={22} />
        </span>
        <div>
          <b>영수증 찍고 단가 바로 반영</b>
          <br />
          품목·양·금액을 읽어 오고, 저장 전에 확인·수정할 수 있어요.
        </div>
      </button>
      <ul className="list" style={{ marginTop: 8 }}>
        {S.ings.length ? (
          S.ings.map((g) => {
            const used = S.menus.filter((m) => m.items.some((i) => i.ing === g.id)).length
            return (
              <li key={g.id}>
                <button className="li" onClick={() => gate({ kind: 'ing', id: g.id })}>
                  <Thumb o={g} kind="ing" />
                  <div className="grow">
                    <div className="t">{g.name}</div>
                    <div className="s num">
                      {won(g.buyPrice)} / {(+g.buyQty).toLocaleString('ko-KR')}
                      {g.unit} · 메뉴 {used}개에 사용
                    </div>
                  </div>
                  <div className="r num">
                    <div className="t">{fmtUnit(unitPrice(g))}원</div>
                    <div className="s">1{g.unit}당</div>
                  </div>
                </button>
              </li>
            )
          })
        ) : (
          <li className="empty">식자재가 없어요.</li>
        )}
      </ul>
      {S.receipts.length > 0 && (
        <section className="sec">
          <div className="row between">
            <span className="label">최근 영수증</span>
            <span className="label num">OCR 수정률 {f ? Math.round((ed / f) * 100) : 0}%</span>
          </div>
          <ul className="list">
            {S.receipts.slice(0, 10).map((r) => (
              <li key={r.id} className="li">
                <div className="grow">
                  <div className="t">{r.store || '영수증'}</div>
                  <div className="s num">
                    {r.date} · 품목 {r.count}개 반영 · 수정 {r.edited}/{r.fields}칸
                  </div>
                </div>
                <div className="r num">
                  <div className="t">{won(r.total)}</div>
                  <div className="s">{SRC[r.source] || ''}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
