import { useEffect, type CSSProperties } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import Toaster from '@/shared/Toaster'
import TabBar from './components/TabBar'
import { notifyCheck } from './lib/pwa'
import { todayKey } from './lib/date'
import AuthPage from './pages/AuthPage'
import Home from './pages/Home'
import Ledger from './pages/Ledger'
import Manage from './pages/Manage'
import Metrics from './pages/Metrics'
import Onboarding from './pages/Onboarding'
import Settings from './pages/Settings'
import FixedSheet from './sheets/FixedSheet'
import IngSheet from './sheets/IngSheet'
import MenuSheet from './sheets/MenuSheet'
import Guide from './sheets/receipt/Guide'
import ReceiptSheet from './sheets/receipt/ReceiptSheet'
import SalesSheet from './sheets/SalesSheet'
import { BellSheet, DaySheet, DocSheet, GateSheet, RcViewSheet, TxAllSheet } from './sheets/smallSheets'
import { store, useStore } from './state/store'
import { useUi } from './state/ui'

/** 화면 위에 뜨는 창 */
function Layer() {
  const { layer } = useUi()
  if (!layer) return null
  switch (layer.kind) {
    case 'sales':
      return <SalesSheet />
    case 'day':
      return <DaySheet key={layer.date} date={layer.date} />
    case 'bell':
      return <BellSheet />
    case 'txAll':
      return <TxAllSheet y={layer.y} m={layer.m} />
    case 'menu':
      return <MenuSheet key={layer.id ?? 'new'} id={layer.id} />
    case 'ing':
      return <IngSheet key={layer.id ?? 'new'} id={layer.id} />
    case 'fixed':
      return <FixedSheet key={layer.id ?? 'new'} id={layer.id} />
    case 'rcView':
      return <RcViewSheet id={layer.id} />
    case 'guide':
      return <Guide thenReceipt={layer.thenReceipt} />
    case 'receipt':
      return <ReceiptSheet />
    case 'gate':
      return <GateSheet />
    case 'doc':
      return <DocSheet doc={layer.doc} />
  }
}

/** 화면 순서: 오른쪽 탭으로 가면 오른쪽에서 들어오는 효과 */
const ORDER: Record<string, number> = {
  '/': 0,
  '/metrics': 0.5,
  '/ledger': 1,
  '/manage': 2,
  '/settings': 3,
  '/auth': 4,
  '/onboarding': 5,
}
let lastPath = ''

export default function App() {
  const { pathname, hash } = useLocation()
  const onboarded = useStore().onboarded
  const signed = !!useStore().user
  const dir = (ORDER[pathname] ?? 0) >= (ORDER[lastPath] ?? 0) ? 1 : -1
  const changed = lastPath !== '' && lastPath !== pathname
  useEffect(() => {
    lastPath = pathname
  }, [pathname])

  // 주소 끝 #id 로 그 칸까지 내리기 (예: /metrics#mx-bep)
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 60)
    return () => clearTimeout(t)
  }, [pathname, hash])

  // 30초마다: 날짜가 바뀌었는지 확인, 마감 알림
  useEffect(() => {
    let day = todayKey()
    const tick = async () => {
      if (todayKey() !== day) {
        day = todayKey()
        store.refresh()
      }
      if (await notifyCheck(store.get()))
        store.update((s) => {
          s.settings.lastNotified = todayKey()
        })
    }
    void tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  // 아직 가게가 없으면: 로그인 화면 → (로그인하거나 '가입 없이 시작') → 온보딩
  if (!onboarded && pathname !== '/auth' && pathname !== '/onboarding')
    return <Navigate to={signed ? '/onboarding' : '/auth'} replace />

  const isAuth = pathname === '/auth'
  const tabbed = !isAuth && pathname !== '/onboarding'
  const cls = [
    'app',
    changed && 'enter',
    isAuth && 'authbg',
    tabbed && 'homebg',
    pathname === '/manage' && 'mgmt',
    pathname === '/settings' && 'setpg',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div className={cls} key={pathname} style={{ '--dx': dir * 14 + 'px' } as CSSProperties}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/ledger" element={<LedgerKeyed />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <TabBar />
      <div id="layer">
        <Layer />
      </div>
      <Toaster />
    </>
  )
}

/** ?d= 가 바뀌면 장부를 새로 그려 그 달로 이동 */
function LedgerKeyed() {
  const { search } = useLocation()
  return <Ledger key={search} />
}
