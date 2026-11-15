/**
 * 서버 부르는 공통 함수. 모든 요청에 로그인 토큰과 가게 ID를 붙여요.
 * VITE_API_BASE 가 비어 있으면 서버 없이 체험 모드 (hasServer = false).
 */
import { ENV } from '@/shared/config'
import { getAccessToken } from '../auth/supabase'
import type { ApiError } from '../types/api'

const BASE = ENV.apiBase.trim().replace(/\/+$/, '')
export const hasServer = !!BASE

export class ApiFail extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function storeId() {
  try {
    return localStorage.getItem('domain.storeId')
  } catch {
    return null
  }
}

/** JSON 요청. body가 FormData면 그대로 보냄 (사진 업로드) */
export async function api<T>(path: string, init: Omit<RequestInit, 'body'> & { body?: unknown } = {}): Promise<T> {
  if (!hasServer) throw new ApiFail(0, 'NO_SERVER', '아직 서버에 연결되지 않았어요.')
  const token = await getAccessToken()
  const sid = storeId()
  const isForm = init.body instanceof FormData
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    body: init.body === undefined ? undefined : isForm ? (init.body as FormData) : JSON.stringify(init.body),
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(sid ? { 'X-Store-Id': sid } : {}),
      ...init.headers,
    },
  })
  const data = (await res.json().catch(() => ({}))) as T & Partial<ApiError>
  if (!res.ok) throw new ApiFail(res.status, data.error?.code ?? 'SERVER_ERROR', data.error?.message ?? `서버 오류가 났어요. (${res.status})`)
  return data
}
