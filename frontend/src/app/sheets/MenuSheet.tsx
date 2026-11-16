import { useState } from 'react'
import { toast } from '@/shared/toast'
import { ArmButton } from '../components/bits'
import Icon from '../components/Icon'
import PhotoField from '../components/PhotoField'
import Sheet from '../components/Sheet'
import { D0, chMargin, findIng, menuCost, menuHist, pushHist } from '../lib/calc'
import { todayKey } from '../lib/date'
import { uid, won } from '../lib/format'
import { store, useStore } from '../state/store'
import { useUi } from '../state/ui'
import type { Menu } from '../types'

type Draft = Omit<Menu, 'price' | 'items'> & { price: number | string; items: { ing: string; qty: number | string }[] }

/**
 * 메뉴 추가·수정: 이름·판매가·사진·레시피 → 원가율 바로 계산.
 * 판매가나 레시피가 바뀌면 오늘 날짜로 이력을 남겨서 지난 매출은 그대로예요.
 * 서버: POST /api/menus · PUT /api/menus/{id}
 */
export default function MenuSheet({ id }: { id?: string }) {
  const S = useStore()
  const { close } = useUi()
  const m0 = S.menus.find((x) => x.id === id)
  const [d, setD] = useState<Draft>(() =>
    m0 ? structuredClone(m0) : { id: uid(), name: '', price: '', items: [{ ing: S.ings[0]?.id || '', qty: '' }] },
  )
  const p = +d.price || 0
  const items = d.items.map((i) => ({ ing: i.ing, qty: +i.qty || 0 }))
  const c = menuCost(S, { items }),
    rate = p ? (c / p) * 100 : 0
  const setItem = (i: number, k: 'ing' | 'qty', v: string) =>
    setD({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })

  const save = () => {
    if (!d.name.trim() || !(p > 0)) return toast('메뉴 이름과 판매가를 입력하세요.')
    const its = d.items.filter((i) => i.ing && +i.qty > 0).map((i) => ({ ing: i.ing, qty: +i.qty }))
    const m: Menu = { id: d.id, name: d.name.trim(), price: p, items: its, img: d.img }
    const e = { price: p, items: its.map((x) => ({ ...x })) }
    if (!m0) m.hist = [{ from: D0, ...e }]
    else {
      m.hist = menuHist(m0)
      if (p !== +m0.price || JSON.stringify(its) !== JSON.stringify(m0.items))
        pushHist(m.hist, { from: todayKey(), ...e })
    }
    store.update((s) => {
      const i = s.menus.findIndex((x) => x.id === m.id)
      if (i >= 0) s.menus[i] = m
      else s.menus.push(m)
    })
    close()
    const r = menuCost(store.get(), m) / p
    toast(r >= 0.4 ? `저장했어요. 원가율 ${Math.round(r * 100)}%로 높아요.` : '저장했어요.')
  }

  return (
    <Sheet
      title={m0 ? '메뉴 수정' : '메뉴 추가'}
      foot={
        <>
          {m0 && (
            <ArmButton
              className="btn danger"
              armed="한 번 더 누르면 삭제"
              onConfirm={() => {
                store.update((s) => {
                  s.menus = s.menus.filter((x) => x.id !== d.id)
                })
                close()
                toast('메뉴를 삭제했어요.')
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
      <PhotoField kind="menu" id={d.id} img={d.img} onChange={(img) => setD({ ...d, img })} />
      <label className="field">
        <span>메뉴 이름</span>
        <input
          autoComplete="off"
          name="m-name"
          className="inp"
          value={d.name}
          placeholder="예: 김치찌개…"
          onChange={(e) => setD({ ...d, name: e.target.value })}
        />
      </label>
      <label className="field">
        <span>판매가 (원)</span>
        <input
          autoComplete="off"
          name="m-price"
          className="inp num"
          type="number"
          min="0"
          step="100"
          value={d.price || ''}
          placeholder="예: 9000…"
          onChange={(e) => setD({ ...d, price: e.target.value })}
        />
      </label>
      <div className="field">
        <span>레시피 · 1인분에 들어가는 양</span>
        {d.items.map((it, i) => (
          <div className="recipe" key={i}>
            <select
              autoComplete="off"
              name={`r-ing-${i}`}
              className="inp"
              value={it.ing}
              onChange={(e) => setItem(i, 'ing', e.target.value)}
              aria-label="식자재"
            >
              {S.ings.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <input
              autoComplete="off"
              name={`r-qty-${i}`}
              className="inp num"
              type="number"
              min="0"
              step="any"
              value={it.qty || ''}
              placeholder="양…"
              onChange={(e) => setItem(i, 'qty', e.target.value)}
              aria-label="양"
            />
            <div className="row" style={{ flexWrap: 'nowrap', gap: 0 }}>
              <span className="u num">{findIng(S, it.ing)?.unit || ''}</span>
              <button
                className="x"
                onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })}
                aria-label="재료 삭제"
              >
                <Icon name="x" width={20} height={20} />
              </button>
            </div>
          </div>
        ))}
        <button
          className="link"
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
          onClick={() => setD({ ...d, items: [...d.items, { ing: S.ings[0].id, qty: '' }] })}
        >
          재료 추가
        </button>
      </div>
      <div className="summary num">
        <div className="line">
          <span>원가</span>
          <b>{won(c)}</b>
        </div>
        <div className="line">
          <span>원가율</span>
          <b style={rate >= 40 ? { color: 'var(--hwp-color-brand-text)' } : undefined}>
            {rate.toFixed(1)}%{rate >= 40 ? ' · 높음' : ''}
          </b>
        </div>
        {S.channels.map((ch) => (
          <div className="line" key={ch.id}>
            <span>{ch.name} 1개 팔면</span>
            <b>{won(chMargin(S, { price: p, items }, ch))}</b>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
