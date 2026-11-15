import { useEffect, useRef, type CSSProperties } from 'react'
import { useLocation } from 'react-router'
import { useUi } from '../state/ui'
import Icon, { type IconName } from './Icon'

const TABS: [path: string, label: string, icon: IconName][] = [
  ['/', '홈', 'home'],
  ['/ledger', '장부', 'book'],
  ['/manage', '관리', 'manage'],
  ['/settings', '설정', 'gear'],
]

const buzz = (ms = 8) => {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* 무시 */
  }
}

/** 아래 떠 있는 탭 바. 선택 표시(blob)가 물방울처럼 미끄러져요. */
export default function TabBar() {
  const { go } = useUi()
  const { pathname } = useLocation()
  const cur = pathname === '/metrics' ? '/' : pathname
  const idx = TABS.findIndex((t) => t[0] === cur)
  const blob = useRef<HTMLSpanElement>(null)
  const prev = useRef(idx)

  useEffect(() => {
    if (idx < 0 || prev.current === idx) return
    prev.current = idx
    const b = blob.current
    if (!b) return
    b.classList.remove('stretch')
    void b.offsetWidth
    b.classList.add('stretch')
  }, [idx])

  if (pathname === '/auth' || pathname === '/onboarding') return null
  return (
    <nav className="nav" aria-label="메뉴">
      <div className="nav-in" style={{ '--i': Math.max(idx, 0) } as CSSProperties}>
        <span className="blob" ref={blob} aria-hidden="true" />
        {TABS.map(([path, label, icon], i) => (
          <button key={path} className="tab" aria-current={i === idx ? 'page' : undefined} onPointerDown={() => buzz(8)} onClick={() => go(path)}>
            <span className="ti">
              <Icon name={icon} />
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
