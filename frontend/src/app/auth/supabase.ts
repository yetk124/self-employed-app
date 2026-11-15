/** Supabase 연결. .env 에 URL·anon 키가 없으면 체험 모드 (이 기기 안에서만 로그인 흉내) */
import type { SupabaseClient } from '@supabase/supabase-js'
import { ENV } from '@/shared/config'

export const AUTH_MOCK = !ENV.supabaseUrl || !ENV.supabaseAnonKey

let sb: SupabaseClient | null = null
export async function sbClient() {
  if (sb) return sb
  const { createClient } = await import('@supabase/supabase-js')
  sb = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey)
  return sb
}

/** API 요청에 붙일 로그인 토큰 */
export async function getAccessToken() {
  if (AUTH_MOCK) return null
  const c = await sbClient()
  const { data } = await c.auth.getSession()
  return data.session?.access_token ?? null
}
