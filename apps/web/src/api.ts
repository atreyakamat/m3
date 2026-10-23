/** M3 web API client.
 *  Unchanged request/response contract with the backend (paths, headers,
 *  payloads). Adds:
 *   - a registered onUnauthorized hook (401 → session-expiry surfacing), and
 *   - probeApi(): a real connectivity check against /health (GET, no auth).
 *  Base-URL heuristics preserved byte-for-byte from the previous client. */

function getBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname
    const envUrl = import.meta.env.VITE_API_BASE_URL
    if (envUrl) {
      try {
        const parsed = new URL(envUrl)
        const targetPort = parsed.port || '8003'
        // If loaded via localhost/127.0.0.1, use current hostname with configured API port
        if ((host === 'localhost' || host === '127.0.0.1') && parsed.hostname !== host) {
          return `http://${host}:${targetPort}${parsed.pathname}`
        }
        // If loaded via active LAN IP, adapt to active hostname with configured API port
        if (host && parsed.hostname !== host && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
          return `${parsed.protocol}//${host}:${targetPort}${parsed.pathname}`
        }
        return envUrl
      } catch {
        return envUrl
      }
    }
    return `${window.location.protocol}//${host}:8003/api/v1`
  }
  return 'http://localhost:8003/api/v1'
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

export const baseUrl = getBaseUrl()

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null
/** Session layer registers this to surface 401 expiry honestly. */
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  onUnauthorized = fn
}

export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const reqId =
    (init.headers as any)?.['X-Request-ID'] ||
    `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': reqId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })
  } catch (err: any) {
    // Network-level failure (offline, DNS, refused). Distinguishable from API errors.
    throw new ApiError(0, err, 'Cannot reach the M3 server. Check the network or the server address.', null)
  }
  if (response.status === 401) {
    try { onUnauthorized?.() } catch { /* handler must not mask the 401 */ }
  }
  if (!response.ok) {
    const respReqId = response.headers.get('X-Request-ID') || reqId
    const body = await response.json().catch(() => ({}))
    const msg = typeof body.detail === 'string'
      ? body.detail
      : body.detail
        ? JSON.stringify(body.detail)
        : `Request failed (${response.status})`
    throw new ApiError(response.status, body.detail, msg, respReqId)
  }
  return response.json() as Promise<T>
}

/** Connectivity probe against /health — never throws. */
export async function probeApi(timeoutMs = 5000): Promise<"ok" | "unreachable" | "down"> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: ctrl.signal })
    if (res.ok) return "ok"
    return "down"
  } catch {
    return "unreachable"
  } finally {
    window.clearTimeout(timer)
  }
}
