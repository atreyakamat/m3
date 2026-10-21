import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
const base = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.2.2:8000/api/v1'
export const baseUrl = base

// Token persistence: native platforms use the OS keystore (SecureStore).
// Web has no keystore; SecureStore is unimplemented there and THROWS, which
// previously broke the entire sign-in flow on web. Fall back to localStorage
// (session storage parity is a known platform gap; web is verification-only).
const WEB_TOKEN_KEY = 'm3-access-token'

export async function saveToken(token: string) {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(WEB_TOKEN_KEY, token) } catch { /* storage outage: session-only */ }
    return
  }
  await SecureStore.setItemAsync('m3-access-token', token)
}

export async function removeToken() {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(WEB_TOKEN_KEY) } catch { /* noop */ }
    return
  }
  await SecureStore.deleteItemAsync('m3-access-token')
}

export class ApiError extends Error {
  status: number
  detail: any
  requestId?: string | null
  constructor(status: number, detail: any, message: string, requestId?: string | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.requestId = requestId
  }
}

export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const reqId =
    (init.headers as any)?.['X-Request-ID'] ||
    `mob_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': reqId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const respReqId = response.headers.get('X-Request-ID') || reqId
    const body = await response.json().catch(() => ({}))
    const raw = (body as any).detail
    const message = typeof raw === 'string' ? raw : (raw?.message || `Request failed (${response.status})`)
    throw new ApiError(response.status, raw, message, respReqId)
  }
  return response.json() as Promise<T>
}
