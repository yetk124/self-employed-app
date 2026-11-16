/**
 * 앱 데이터 저장소.
 * 화면은 늘 여기(기기 저장소)를 읽고 고쳐요. 로그인해서 서버 가게가 연결되면
 * api/sync.ts 가 바뀐 내용을 서버로 올리고, 앱을 열 때 서버 데이터로 맞춰요.
 *
 * 쓰는 법
 *   const S = useStore()                       // 화면에서 읽기 (바뀌면 다시 그려짐)
 *   store.update(s => { s.settings.store = 'x' }) // 고치기 (복사본을 고쳐서 바꿈 → 저장)
 */
import { useSyncExternalStore } from 'react'
import { blank, boot } from '../lib/seed'
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
  if (!Array.isArray(s.settings.offDays)) s.settings.offDays = []
  // 예시 데이터(가입 전 둘러보기)로 보던 상태면 빈 가게로 새로 시작 (2026-11-15 예시 데이터 제거)
  if (s.sample) return { ...blank(), user: s.user ?? null }
  // 그래프 확인용으로 넣었던 임시 데이터 지우기
  const demo = s.demo as { days?: string[]; fixed?: string[]; receipts?: string[] } | undefined
  if (demo) {
    demo.days?.forEach((k) => {
      delete s.sales[k]
      delete s.adj[k]
    })
    s.fixed = s.fixed.filter((f) => !demo.fixed?.includes(f.id))
    s.receipts = s.receipts.filter((x) => !demo.receipts?.includes(x.id))
  }
  // 배달 채널 제거(2026-10-30): 배민·쿠팡 판매 수량은 포장으로 옮김
  if (s.channels.some((c) => c.id === 'baemin' || c.id === 'coupang')) {
    s.channels = s.channels.filter((c) => c.id !== 'baemin' && c.id !== 'coupang')
    if (!s.channels.some((c) => c.id === 'takeout'))
      s.channels.push({ id: 'takeout', name: '포장', fee: 0, fixed: 300 })
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
  for (const k of ['_demoDay', '_filled', '_adjSeed', 'sample', 'demo', 'demoOff', 'filledOn', 'demoOn']) delete s[k]
  delete (s.settings as unknown as Record<string, unknown>).ocrApi
  return s
}

let S: AppState = migrate(load() ?? blank())
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
  /** 통째로 바꾸기 (템플릿 불러오기, 서버에서 내려받기, 로그아웃) */
  replace(next: AppState) {
    S = next
    boot(S)
    save()
    emit()
  },
  /** 날짜가 바뀌었을 때 */
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
