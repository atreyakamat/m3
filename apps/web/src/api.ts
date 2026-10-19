export const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } })
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail || `Request failed (${response.status})`) }
  return response.json() as Promise<T>
}
