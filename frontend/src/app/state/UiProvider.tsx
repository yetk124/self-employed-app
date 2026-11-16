import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { track } from '@/shared/analytics'
import { toast } from '@/shared/toast'
import { connect, resume } from '../api/sync'
import { Auth, PROV } from '../auth/auth'
import { todayKey } from '../lib/date'
import type { User } from '../types'
import { store } from './store'
import { Ctx, type AuthUi, type Layer, type UiCtx } from './ui'

function readGateSkip() {
  try {
    return sessionStorage.getItem('domain.gateSkip') === '1'
  } catch {
    return false
  }
}

export default function UiProvider({ children }: { children: ReactNode }) {
  const nav = useNavigate()
  const loc = useLocation()
  const [sel, setSel] = useState(todayKey)
  const [ch, setCh] = useState('hall')
  const [layer, setLayer] = useState<Layer | null>(null)
  const [auth, setAuthState] = useState<AuthUi>({ mode: 'main', tab: 'signup', from: '/' })
  const pending = useRef<Layer | null>(null)
  const gateSkipped = useRef(readGateSkip())

  const go = useCallback(
    (path: string) => {
      setLayer(null)
      nav(path)
      scrollTo(0, 0)
    },
    [nav],
  )
  const open = useCallback((l: Layer) => setLayer(l), [])
  const close = useCallback(() => setLayer(null), [])

  const runPending = useCallback(() => {
    const l = pending.current
    pending.current = null
    if (l) setTimeout(() => setLayer(l), 50)
  }, [])

  const gate = useCallback((l: Layer) => {
    if (store.get().user || gateSkipped.current) return setLayer(l)
    pending.current = l
    setLayer({ kind: 'gate' })
  }, [])

  const skipGate = useCallback(() => {
    gateSkipped.current = true
    try {
      sessionStorage.setItem('domain.gateSkip', '1')
    } catch {
      /* 무시 */
    }
    setLayer(null)
    runPending()
  }, [runPending])

  const openReceipt = useCallback(() => {
    const go = () =>
      store.get().ocrGuideSeen ? setLayer({ kind: 'receipt' }) : setLayer({ kind: 'guide', thenReceipt: true })
    if (store.get().user || gateSkipped.current) go()
    else {
      pending.current = store.get().ocrGuideSeen ? { kind: 'receipt' } : { kind: 'guide', thenReceipt: true }
      setLayer({ kind: 'gate' })
    }
  }, [])

  const salesToday = useCallback(() => {
    setSel(todayKey())
    gate({ kind: 'sales' })
  }, [gate])

  const setAuth = useCallback((p: Partial<AuthUi>) => setAuthState((a) => ({ ...a, ...p })), [])
  const openAuth = useCallback(
    (p: Partial<AuthUi> = {}) => {
      setAuthState((a) => ({ ...a, mode: 'main', from: loc.pathname === '/auth' ? a.from : loc.pathname, ...p }))
      setLayer(null)
      nav('/auth')
      scrollTo(0, 0)
    },
    [loc.pathname, nav],
  )

  const signedIn = useCallback(
    async (u: User) => {
      const S = store.get()
      store.update((s) => {
        s.user = { ...u, since: S.user?.since || new Date().toISOString() }
      })
      track('login', { method: u.provider })
      // 서버 가게 연결: 있으면 내려받고, 기기에서 쓰던 가게가 있으면 서버로 옮겨요
      const r = await connect()
      if (r === 'imported') toast('이 기기에 입력한 기록을 계정에 옮겼어요.')
      if (!store.get().onboarded) {
        nav('/onboarding')
        scrollTo(0, 0)
      } else {
        const from = auth.from && !['/auth', '/onboarding'].includes(auth.from) ? auth.from : '/'
        nav(from)
        if (r !== 'imported') toast(`${PROV[u.provider]} 계정으로 로그인했어요.`)
        runPending()
      }
    },
    [auth.from, nav, runPending],
  )

  // 앱을 열 때 이미 로그인돼 있으면 서버 최신 데이터로 맞추기
  useEffect(() => {
    void resume()
  }, [])

  // 카카오·구글에서 돌아왔을 때
  useEffect(() => {
    let off: (() => void) | undefined
    Auth.onSession((u) => {
      if (!store.get().user) void signedIn(u)
    }).then((f) => (off = f))
    return () => off?.()
  }, [signedIn])

  // Esc 로 창 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLayer(null)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo<UiCtx>(
    () => ({
      sel,
      setSel,
      ch,
      setCh,
      layer,
      open,
      close,
      gate,
      skipGate,
      openReceipt,
      salesToday,
      go,
      auth,
      setAuth,
      openAuth,
      signedIn,
    }),
    [sel, ch, layer, open, close, gate, skipGate, openReceipt, salesToday, go, auth, setAuth, openAuth, signedIn],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
