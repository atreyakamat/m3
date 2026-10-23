import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { readMeta, writeMeta, deleteMeta } from './cache'
import { useAppStore } from './store'

// ---------------------------------------------------------------------------
// Task 1: runtime-configurable API base URL.
//
// Resolution order (first valid hit wins):
//   1. A custom server URL saved at runtime by the sign-in screen's
//      "Server Configuration" dialog — the stored value lives in cache_meta
//      (synchronous on every platform), which also makes LAN-IP or public
//      tunnel URLs survive app restarts without rebuilding the APK.
//   2. Build-time EXPO_PUBLIC_API_BASE_URL.
//   3. Platform default (Android emulator 10.0.2.2 / localhost).
// ---------------------------------------------------------------------------

const SERVER_URL_META_KEY = 'customServerUrl'

/** Normalizes user input into a full API base URL ending with /api/v1.
 * Accepts any scheme-less host form ("192.168.1.116:8003") plus full URLs,
 * including public tunnel URLs ("https://xyz.trycloudflare.com"). */
export function normalizeServerUrl(input: string): string | null {
  let raw = String(input || '').trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) raw = 'http://' + raw
  try {
    const parsed = new URL(raw)
    if (!parsed.hostname) return null
  } catch {
    return null
  }
  let cleaned = raw.replace(/\/+$/, '')
  if (!cleaned.endsWith('/api/v1')) cleaned += '/api/v1'
  return cleaned
}

// ---------------------------------------------------------------------------
// Standalone Local Server mode (Phase 5): the tablet hosts the REAL FastAPI
// backend in-process (Chaquopy CPython + uvicorn, see docs/STANDALONE_LOCAL_SERVER.md).
// In this mode the base URL is FORCED to the loopback server — the runtime
// stored custom server URL and every other resolution branch are ignored, so a
// request can never accidentally reach a previously-configured remote server.
// The stored remote URL is preserved untouched and re-activated when local
// mode is switched off.
// ---------------------------------------------------------------------------

const LOCAL_MODE_META_KEY = 'localMode'
/** Must match LocalServerModule.kt / m3_local_server.py (loopback-only bind). */
export const LOCAL_SERVER_PORT = 8741
const LOCAL_API_BASE = `http://127.0.0.1:${LOCAL_SERVER_PORT}/api/v1`

let localModeActive = false

function resolveMobileBaseUrl(): string {
  if (localModeActive) {
    return LOCAL_API_BASE
  }
  const stored = readMeta(SERVER_URL_META_KEY)
  if (stored && /^https?:\/\/.+/.test(stored)) {
    return stored
  }
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL
  if (envUrl) {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      try {
        const parsed = new URL(envUrl)
        const host = window.location.hostname
        if ((host === 'localhost' || host === '127.0.0.1') && parsed.hostname !== host) {
          return `http://${host}:${parsed.port || '8003'}${parsed.pathname}`
        }
      } catch {
        // use envUrl
      }
    }
    return envUrl
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8003/api/v1'
  }
  return 'http://127.0.0.1:8003/api/v1'
}

/** The API root every request is appended to. Re-resolved when the user saves
 * or clears a custom server URL; exported as a mutable binding so callers
 * always read the current value, plus base() as an explicit accessor. */
export let baseUrl = resolveMobileBaseUrl()
export const base = (): string => baseUrl

/** Apply a server URL at runtime. null restores the default resolution chain.
 * Also persisted to cache_meta so the choice survives restarts. */
export function applyServerUrl(url: string | null): string {
  if (url && normalizeServerUrl(url)) {
    const normalized = normalizeServerUrl(url)!
    writeMeta(SERVER_URL_META_KEY, normalized)
    baseUrl = normalized
    return normalized
  }
  deleteMeta(SERVER_URL_META_KEY)
  baseUrl = resolveMobileBaseUrl()
  return baseUrl
}

/** Called at app start to pick up a persisted custom URL (if it was written
 * before this module loaded) — cheap and stable on every platform. Also
 * restores the persisted Standalone Local Server mode flag if a previous
 * session used it (`isLocalMode()` then reports the truth before the app UI
 * asks the native server bridge to start). */
export function initBaseUrl(): string {
  localModeActive = readMeta(LOCAL_MODE_META_KEY) === '1'
  baseUrl = resolveMobileBaseUrl()
  return baseUrl
}

// --- Standalone Local Server mode ----------------------------------------

/** The current local-server mode (device hosting the real backend). The
 * persisted flag survives restarts so returning to the app re-enters the
 * same server lifecycle instead of silently falling back to a remote URL. */
export const isLocalMode = (): boolean => localModeActive

/** The forced loopback URL used in local mode (also used by readiness probes). */
export const localApiBase = (): string => LOCAL_API_BASE

/** Enter/leave standalone local-server mode. The custom (remote) server URL
 * stored in cache_meta is NEVER modified — switching modes back re-activates
 * it exactly as saved. */
export function setLocalMode(active: boolean): string {
  localModeActive = active
  if (active) writeMeta(LOCAL_MODE_META_KEY, '1')
  else deleteMeta(LOCAL_MODE_META_KEY)
  baseUrl = resolveMobileBaseUrl()
  return baseUrl
}

/** Health probe for the "Test Connection" button in the server dialog.
 * Returns the HTTP status on success; throws on any transport failure. */
export async function probeServerUrl(url: string, timeoutMs = 6000): Promise<number> {
  const normalized = normalizeServerUrl(url)
  if (!normalized) throw new Error('Invalid URL')
  const root = normalized.replace(/\/api\/v1$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${root}/health`, { signal: controller.signal })
    return response.status
  } finally {
    clearTimeout(timer)
  }
}

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

  const response = await fetch(`${baseUrl}${path}`, {
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
    // Central 401 session-degradation hook: a request that CARRIED a token and
    // got 401 means the session is expired/revoked. Only flag the store (the
    // token itself must stay — screens persist drafts tied to the session);
    // the dashboard banner lets the user explicitly sign out. Never let this
    // observation break the normal ApiError contract.
    if (response.status === 401 && token) {
      try {
        useAppStore.getState().markSessionExpired()
      } catch {
        // store not ready (edge bundling scenarios): per-screen alerts still fire
      }
    }
    throw new ApiError(response.status, raw, message, respReqId)
  }
  return response.json() as Promise<T>
}
