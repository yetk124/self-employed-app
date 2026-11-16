/** 업종 템플릿으로 새 가게 상태 만들기 (메뉴·식자재만, 판매 기록 없음) */
import { CH_DEFAULT, TPL } from '../data/templates'
import type { AppState, BizKey } from '../types'
import { D0, migrateHist } from './calc'

export function seed(key: BizKey): AppState {
  const t = TPL[key]
  return {
    v: 2,
    tpl: key,
    settings: { store: t.store, open: '11:00', close: '21:30', notify: false, lastNotified: '', offDays: [] },
    channels: CH_DEFAULT.map((c) => ({ ...c })),
    ings: t.ings.map(([id, name, unit, buyPrice, buyQty]) => ({
      id,
      name,
      unit,
      buyPrice,
      buyQty,
      hist: [{ from: D0, buyPrice, buyQty }],
    })),
    menus: t.menus.map(([id, name, price, items]) => {
      const it = items.map(([ing, qty]) => ({ ing, qty }))
      return { id, name, price, items: it, hist: [{ from: D0, price, items: it.map((x) => ({ ...x })) }] }
    }),
    sales: {},
    adj: {},
    off: {},
    fixed: [],
    receipts: [],
  }
}

/** 처음 여는 사람: 아무것도 없는 빈 가게 (온보딩에서 업종을 고르면 seed 로 바꿔요) */
export function blank(): AppState {
  const s = seed('hansik')
  return { ...s, tpl: 'etc', settings: { ...s.settings, store: '' }, ings: [], menus: [] }
}

/** 앱을 열 때·날짜가 바뀔 때: 예전 데이터에 가격 이력 칸이 없으면 만들기 */
export function boot(S: AppState) {
  migrateHist(S)
}
