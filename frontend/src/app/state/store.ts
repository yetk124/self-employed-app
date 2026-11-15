/**
 * 앱 데이터 저장소.
 * 지금은 기기(localStorage)에 저장해요. 백엔드가 붙으면 바뀌는 곳은 api/ 폴더와 여기 save() 뿐이에요.
 *
 * 쓰는 법
 *   const S = useStore()                       // 화면에서 읽기 (바뀌면 다시 그려짐)
 *   store.update(s => { s.settings.store = 'x' }) // 고치기 (복사본을 고쳐서 바꿈 → 저장)
 */
import { useSyncExternalStore } from 'react'
import { boot, seed } from '../lib/demo'
import type { AppState } from '../types'

const KEY = 'todaymargin.v1'

function load(): AppState | null {
  try {
    const s = localStorage.getItem(KEY)
    return s ? (JSON.parse(s) as AppState) : null
  } catch {
    return null
  }
}

/** 예전 프로토타입·이전 버전 데이터를 지금 모양으로 맞춤 */
function migrate(raw: AppState): AppState {
  const s = raw as AppState & Record<string, unknown>
  s.v = 2
  s.receipts ??= []
  s.fixed ??= []
  s.adj ??= {}
  s.off ??= {}
  s.settings.open ||= '11:00'
  if (!Array.isArray(s.settings.offDays)) s.settings.offDays = s.sample ? [0] : []
  // 배달 채널 제거(2026-10-30): 배민·쿠팡 판매 수량은 포장으로 옮김
  if (s.channels.some((c) => c.id === 'baemin' || c.id === 'coupang')) {
    s.channels = s.channels.filter((c) => c.id !== 'baemin' && c.id !== 'coupang')
    if (!s.channels.some((c) => c.id === 'takeout')) s.channels.push({ id: 'takeout', name: '포장', fee: 0, fixed: 300 })
    for (const d in s.sales)
      for (const mid in s.sales[d]) {
        const x = s.sales[d][mid],
          mv = (+x.baemin || 0) + (+x.coupang || 0)
        delete x.baemin
        delete x.coupang
        if (mv) x.takeout = (+x.takeout || 0) + mv
      }
  }
  // 프로토타입에만 있던 칸 정리
  for (const k of ['_demoDay', '_filled', '_adjSeed']) delete s[k]
  delete (s.settings as unknown as Record<string, unknown>).ocrApi
  return s
}

let S: AppState = migrate(load() ?? seed('hansik', true))
boot(S)
const listeners = new Set<() => void>()

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S))
  } catch {
    /* 저장 공간이 없거나 막힌 경우 */
  }
}
save()

function emit() {
  listeners.forEach((l) => l())
}

export const store = {
  get: () => S,
  /** 복사본을 고쳐서 바꾼다 */
  update(fn: (s: AppState) => void) {
    const next = structuredClone(S)
    fn(next)
    S = next
    save()
    emit()
  },
  /** 통째로 바꾸기 (템플릿 불러오기, 탈퇴) */
  replace(next: AppState) {
    S = next
    boot(S)
    save()
    emit()
  },
  /** 날짜가 바뀌었을 때 예시·임시 데이터 다시 채우기 */
  refresh() {
    store.update(boot)
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}

export const useStore = () => useSyncExternalStore(store.subscribe, store.get)
