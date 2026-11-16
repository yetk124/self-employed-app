import { describe, expect, it } from 'vitest'
import { seed } from './seed'
import { dayStats, pushHist, syncIng } from './calc'
import { parseReceipt, rcPlan, SAMPLE_RECEIPT, toItems } from './receipt'

describe('가격 이력', () => {
  it('오늘 단가가 바뀌어도 지난 날 이익은 그대로', () => {
    const S = seed('hansik')
    const past = '2026-01-05'
    S.sales[past] = { kjj: { hall: 10 } }
    const before = dayStats(S, past).profit
    const kimchi = S.ings.find((g) => g.id === 'kimchi')!
    pushHist(kimchi.hist!, { from: '2026-02-01', buyPrice: 60000, buyQty: 10000 })
    syncIng(kimchi)
    expect(dayStats(S, past).profit).toBe(before)
    S.sales['2026-02-02'] = { kjj: { hall: 10 } }
    expect(dayStats(S, '2026-02-02').profit).toBeLessThan(before)
  })
})

describe('영수증', () => {
  it('예시 영수증을 품목으로 읽음', () => {
    const p = parseReceipt(SAMPLE_RECEIPT)
    expect(p.store).toBe('행복식자재마트')
    expect(p.total).toBe(44400)
    expect(p.items[0]).toMatchObject({ name: '양파', qty: 3000, unit: 'g', amount: 6900 })
  })
  it('기존 식자재에 매칭되고 단가가 바뀜', () => {
    const S = seed('hansik')
    const items = toItems(S, parseReceipt(SAMPLE_RECEIPT))
    expect(items.find((i) => i.name === '양파')!.match).toBe('onion')
    const P = rcPlan(S, items, '2026-10-20')
    expect(P.upd.some((u) => u.g.id === 'onion')).toBe(true)
    expect(P.add.some((i) => i.name === '깐마늘')).toBe(true)
  })
})
