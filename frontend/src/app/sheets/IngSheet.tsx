import { useState } from 'react'
import { toast } from '@/shared/toast'
import { ArmButton } from '../components/bits'
import PhotoField from '../components/PhotoField'
import Sheet from '../components/Sheet'
import { UNITS } from '../data/templates'
import { D0, ingHist, menuCost, pushHist, unitPrice } from '../lib/calc'
import { todayKey } from '../lib/date'
import { fmtUnit, uid } from '../lib/format'
import { store, useStore } from '../state/store'
import { useUi } from '../state/ui'
import type { Ingredient, Unit } from '../types'

/**
 * 식자재 추가·수정: 산 가격 ÷ 산 양 = 1단위당 가격.
 * 단가가 바뀌면 오늘 날짜로 가격 이력을 남겨서 지난 장부는 그대로예요.
 * 서버: POST /api/ingredients · PUT /api/ingredients/{id}
 */
export default function IngSheet({ id }: { id?: string }) {
  const S = useStore()
  const { close } = useUi()
  const g0 = S.ings.find((x) => x.id === id)
  const [d, setD] = useState(() => ({
    id: g0?.id ?? uid(),
    name: g0?.name ?? '',
    unit: (g0?.unit ?? 'g') as Unit,
    buyPrice: g0 ? String(g0.buyPrice) : '',
    buyQty: g0 ? String(g0.buyQty) : '',
    img: g0?.img,
  }))
  const used = S.menus.filter((m) => m.items.some((i) => i.ing === d.id))
  const up = unitPrice({ buyPrice: +d.buyPrice || 0, buyQty: +d.buyQty || 0 })

  const save = () => {
    const bp = +d.buyPrice,
      bq = +d.buyQty
    if (!d.name.trim() || !(bp > 0) || !(bq > 0)) return toast('이름, 산 가격, 산 양을 입력하세요.')
    const g: Ingredient = { id: d.id, name: d.name.trim(), unit: d.unit, buyPrice: bp, buyQty: bq, img: d.img }
    if (!g0) g.hist = [{ from: D0, buyPrice: bp, buyQty: bq }]
    else {
      g.hist = ingHist(g0)
      if (bp !== +g0.buyPrice || bq !== +g0.buyQty) pushHist(g.hist, { from: todayKey(), buyPrice: bp, buyQty: bq })
    }
    const before: Record<string, number> = {}
    S.menus.forEach((m) => (before[m.id] = menuCost(S, m)))
    store.update((s) => {
      const i = s.ings.findIndex((x) => x.id === g.id)
      if (i >= 0) s.ings[i] = g
      else s.ings.push(g)
      s.sample = false
    })
    close()
    const after = store.get(),
      hit = after.menus.filter((m) => Math.round(menuCost(after, m)) !== Math.round(before[m.id]))
    if (g0 && unitPrice(g) !== unitPrice(g0) && hit.length)
      toast(
        '원가가 바뀐 메뉴: ' +
          hit
            .map((m) => {
              const dd = menuCost(after, m) - before[m.id]
              return `${m.name} ${dd > 0 ? '+' : ''}${Math.round(dd)}원`
            })
            .join(', '),
      )
    else toast('저장했어요.')
  }

  return (
    <Sheet
      title={g0 ? '식자재 수정' : '식자재 추가'}
      foot={
        <>
          {g0 && (
            <ArmButton
              className="btn danger"
              armed="한 번 더 누르면 삭제"
              onConfirm={() => {
                if (S.menus.some((m) => m.items.some((i) => i.ing === d.id))) return toast('메뉴 레시피에서 먼저 빼 주세요.')
                store.update((s) => {
                  s.ings = s.ings.filter((x) => x.id !== d.id)
                })
                close()
                toast('식자재를 삭제했어요.')
              }}
            >
              삭제
            </ArmButton>
          )}
          <button className="btn primary" style={{ flex: 1 }} onClick={save}>
            저장
          </button>
        </>
      }
    >
      <PhotoField kind="ing" id={d.id} img={d.img} onChange={(img) => setD({ ...d, img })} />
      <label className="field">
        <span>이름</span>
        <input autoComplete="off" name="g-name" className="inp" value={d.name} placeholder="예: 돼지고기 앞다리…" onChange={(e) => setD({ ...d, name: e.target.value })} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>산 가격 (원)</span>
          <input autoComplete="off" name="g-price" className="inp num" type="number" min="0" step="100" value={d.buyPrice} placeholder="예: 13000…" onChange={(e) => setD({ ...d, buyPrice: e.target.value })} />
        </label>
        <label className="field">
          <span>산 양</span>
          <input autoComplete="off" name="g-qty" className="inp num" type="number" min="0" step="any" value={d.buyQty} placeholder="예: 1000…" onChange={(e) => setD({ ...d, buyQty: e.target.value })} />
        </label>
      </div>
      <label className="field">
        <span>단위</span>
        <select autoComplete="off" name="g-unit" className="inp" value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value as Unit })}>
          {UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </label>
      <div className="summary num">
        <div className="line">
          <span>1{d.unit}당 가격</span>
          <b>{fmtUnit(up)}원</b>
        </div>
      </div>
      {used.length > 0 && (
        <div className="field">
          <span>이 재료를 쓰는 메뉴</span>
          <div className="margins">
            {used.map((m) => (
              <span key={m.id}>
                <b>{m.name}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}
