/**
 * 로그인·가입 (카카오 · 구글 · 이메일).
 * 실제 로그인은 FastAPI가 아니라 프론트 → Supabase Auth 로 직접 해요.
 * Supabase 대시보드 → Authentication → Providers 에서 Kakao·Google·Email 을 켜야 해요.
 */
import type { Provider, User } from '../types'
import { AUTH_MOCK, sbClient } from './supabase'

export const PROV: Record<Provider, string> = { kakao: '카카오', google: '구글', email: '이메일' }

export type SignResult = { user: User; isNew: boolean } | { confirm: true } | null

const sha = async (t: string) => {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
  } catch {
    return 'x' + t.length
  }
}
type MockUsers = Record<string, { pw: string; marketing: boolean; at: number }>
const mockUsers = (): MockUsers => {
  try {
    return JSON.parse(localStorage.getItem('domain.mockUsers') || '{}') as MockUsers
  } catch {
    return {}
  }
}
const saveMockUsers = (u: MockUsers) => {
  try {
    localStorage.setItem('domain.mockUsers', JSON.stringify(u))
  } catch {
    /* 무시 */
  }
}
const back = () => location.origin + location.pathname

export const emailOk = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)
export const pwOk = (v: string) => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v)

export const Auth = {
  /** 체험 모드면 바로 로그인, 아니면 카카오·구글 화면으로 이동 (null) */
  async oauth(provider: 'kakao' | 'google', onboarded: boolean): Promise<SignResult> {
    if (AUTH_MOCK)
      return {
        user: { provider, email: provider === 'kakao' ? 'kakao_user@kakao.com' : 'owner@gmail.com', name: PROV[provider] + ' 사장님' },
        isNew: !onboarded,
      }
    const c = await sbClient()
    const { error } = await c.auth.signInWithOAuth({ provider, options: { redirectTo: back() } })
    if (error) throw new Error(error.message)
    return null
  },
  async signUp(email: string, pw: string, marketing: boolean): Promise<SignResult> {
    if (AUTH_MOCK) {
      const u = mockUsers()
      if (u[email]) throw new Error('이미 가입한 이메일이에요. 로그인해 주세요.')
      u[email] = { pw: await sha(pw), marketing, at: Date.now() }
      saveMockUsers(u)
      return { user: { provider: 'email', email, name: email.split('@')[0] }, isNew: true }
    }
    const c = await sbClient()
    const { data, error } = await c.auth.signUp({ email, password: pw, options: { data: { marketing }, emailRedirectTo: back() } })
    if (error) throw new Error(error.message)
    return data.session ? { user: { provider: 'email', email, name: email.split('@')[0] }, isNew: true } : { confirm: true }
  },
  async signIn(email: string, pw: string): Promise<SignResult> {
    if (AUTH_MOCK) {
      const u = mockUsers()[email]
      if (!u || u.pw !== (await sha(pw))) throw new Error('이메일 또는 비밀번호가 맞지 않아요.')
      return { user: { provider: 'email', email, name: email.split('@')[0] }, isNew: false }
    }
    const c = await sbClient()
    const { error } = await c.auth.signInWithPassword({ email, password: pw })
    if (error) throw new Error('이메일 또는 비밀번호가 맞지 않아요.')
    return { user: { provider: 'email', email, name: email.split('@')[0] }, isNew: false }
  },
  async reset(email: string) {
    if (AUTH_MOCK) return
    const c = await sbClient()
    const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: back() })
    if (error) throw new Error(error.message)
  },
  async signOut() {
    if (!AUTH_MOCK) {
      const c = await sbClient()
      await c.auth.signOut()
    }
  },
  /** 카카오·구글에서 돌아왔을 때 로그인 상태 받기 */
  async onSession(cb: (u: User) => void) {
    if (AUTH_MOCK) return () => {}
    const c = await sbClient()
    const { data } = c.auth.onAuthStateChange((_ev, session) => {
      const u = session?.user
      if (!u) return
      const pv = (u.app_metadata?.provider as Provider) || 'email'
      const meta = u.user_metadata as { name?: string; full_name?: string } | undefined
      cb({ provider: pv, email: u.email || '', name: meta?.name || meta?.full_name || (u.email || '').split('@')[0] })
    })
    return () => data.subscription.unsubscribe()
  },
}

export { AUTH_MOCK }
