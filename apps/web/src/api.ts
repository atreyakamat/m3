function getBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname
    const envUrl = import.meta.env.VITE_API_BASE_URL
    if (envUrl) {
      try {
        const parsed = new URL(envUrl)
        // If loaded via localhost/127.0.0.1 and env is a stale LAN IP, prefer current hostname on port 8001
        if ((host === 'localhost' || host === '127.0.0.1') && parsed.hostname !== host) {
          return `http://${host}:${parsed.port || '8001'}${parsed.pathname}`
        }
        // If loaded via active LAN IP and env points to a different IP, adapt to active host
        if (host && parsed.hostname !== host && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
          return `${parsed.protocol}//${host}:${parsed.port || '8001'}${parsed.pathname}`
        }
        return envUrl
      } catch {
        return envUrl
      }
    }
    return `${window.location.protocol}//${host}:8001/api/v1`
  }
  return 'http://localhost:8001/api/v1'
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

export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const reqId =
    (init.headers as any)?.['X-Request-ID'] ||
    `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

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
    const msg = typeof body.detail === 'string'
      ? body.detail
      : body.detail
        ? JSON.stringify(body.detail)
        : `Request failed (${response.status})`
    throw new ApiError(response.status, body.detail, msg, respReqId)
  }
  return response.json() as Promise<T>
}
