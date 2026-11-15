import { createContext, useContext } from 'react'
import type { DocKey } from '../data/docs'
import type { User } from '../types'

/** 화면 위에 뜨는 창(시트) */
export type Layer =
  | { kind: 'sales' }
  | { kind: 'day'; date: string }
  | { kind: 'bell' }
  | { kind: 'txAll'; y: number; m: number }
  | { kind: 'menu'; id?: string }
  | { kind: 'ing'; id?: string }
  | { kind: 'fixed'; id?: string }
  | { kind: 'rcView'; id: string }
  | { kind: 'guide'; thenReceipt: boolean }
  | { kind: 'receipt' }
  | { kind: 'gate' }
  | { kind: 'doc'; doc: DocKey }

export interface AuthUi {
  mode: 'main' | 'email'
  tab: 'signup' | 'login'
  /** 로그인 끝나면 돌아갈 주소 */
  from: string
}

export interface UiCtx {
  /** 고른 날짜 (판매 입력·장부) */
  sel: string
  setSel: (d: string) => void
  /** 판매 입력 시트에서 고른 채널 */
  ch: string
  setCh: (c: string) => void
  layer: Layer | null
  open: (l: Layer) => void
  close: () => void
  /** 비회원이면 로그인 유도 창을 먼저 띄우고, 로그인·"나중에" 뒤에 l 을 연다 */
  gate: (l: Layer) => void
  skipGate: () => void
  /** 영수증: 처음이면 사용법 가이드부터 */
  openReceipt: () => void
  /** 오늘 판매 입력 */
  salesToday: () => void
  go: (path: string) => void
  auth: AuthUi
  setAuth: (p: Partial<AuthUi>) => void
  openAuth: (p?: Partial<AuthUi>) => void
  signedIn: (u: User, isNew: boolean) => void
}

export const Ctx = createContext<UiCtx | null>(null)

export function useUi() {
  const c = useContext(Ctx)
  if (!c) throw new Error('UiProvider 안에서만 쓸 수 있어요.')
  return c
}
