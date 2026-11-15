/** 홈 화면 설치 · 마감 알림 */
import { toast } from '@/shared/toast'
import type { AppState } from '../types'
import { dayStats, isOffDay } from './calc'
import { now, todayKey } from './date'
import { pad } from './format'

interface InstallEvent extends Event {
  prompt: () => void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
let deferred: InstallEvent | null = null
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as InstallEvent
})

export async function install(): Promise<string> {
  if (deferred) {
    deferred.prompt()
    const r = await deferred.userChoice
    deferred = null
    return r.outcome === 'accepted' ? '설치했어요.' : '다음에 설치할 수 있어요.'
  }
  return matchMedia('(display-mode: standalone)').matches ? '이미 앱으로 실행 중이에요.' : '브라우저 메뉴의 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 누르세요.'
}

export async function askNotify() {
  try {
    if ('Notification' in window) return await Notification.requestPermission()
  } catch {
    /* 무시 */
  }
  return 'unsupported'
}

/**
 * 마감 알림 (앱이 열려 있을 때). 앱이 꺼져 있어도 받으려면 서버 Web Push 가 필요해요
 * → POST /api/push/subscribe + 서버 스케줄러.
 * 알림을 보냈으면 true (lastNotified 저장용)
 */
export async function notifyCheck(S: AppState) {
  const s = S.settings
  if (!s.notify) return false
  const n = now(),
    hm = pad(n.getHours()) + ':' + pad(n.getMinutes()),
    today = todayKey()
  if (hm < s.close || s.lastNotified === today || isOffDay(S, today) || dayStats(S, today).cnt) return false
  const [h, mi] = s.close.split(':').map(Number)
  if (n.getHours() * 60 + n.getMinutes() - (h * 60 + mi) > 90) return false
  const body = '오늘 판매를 1분 만에 입력하고 이익을 확인하세요.'
  toast('영업 마감 시간이에요. ' + body)
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const r = await navigator.serviceWorker?.getRegistration?.()
      if (r) r.showNotification('domain', { body, icon: '/icons/icon-192.png', tag: 'close' })
      else new Notification('domain', { body })
    }
  } catch {
    /* 무시 */
  }
  return true
}
