import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/jua'
import '@fontsource/gowun-dodum'
import './app.css'
import { initAnalytics } from '@/shared/analytics'
import App from './App'
import UiProvider from './state/UiProvider'

initAnalytics()
registerSW({ immediate: true })

// 앱 주소: /app/ (홈) · /app/metrics · /app/ledger · /app/manage?tab= · /app/settings · /app/auth · /app/onboarding
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/app">
      <UiProvider>
        <App />
      </UiProvider>
    </BrowserRouter>
  </StrictMode>,
)

// 시작 화면(로고): 처음 열 때만 1.4초 보여 주고 사라짐
const sp = document.getElementById('splash')
if (sp) {
  let seen = false
  try {
    seen = sessionStorage.getItem('domain.splash') === '1'
    sessionStorage.setItem('domain.splash', '1')
  } catch {
    /* 무시 */
  }
  const hide = () => {
    sp.classList.add('out')
    setTimeout(() => sp.remove(), 400)
  }
  if (seen) sp.remove()
  else {
    sp.addEventListener('click', hide)
    setTimeout(hide, 1400)
  }
}
