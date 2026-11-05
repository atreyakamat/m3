const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8003/api/v1';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

function getAuthToken(): string | null {
  if (authToken) return authToken;
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('m3.auth') : null;
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: unknown };
      if (parsed && typeof parsed.token === 'string') {
        authToken = parsed.token;
        return parsed.token;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Pulls a human-readable message out of an unknown error body, without `any`. */
function extractMessage(data: unknown): string | null {
  if (data && typeof data === 'object' && 'message' in data) {
    const m = (data as { message: unknown }).message;
    if (Array.isArray(m)) return m.map(String).join(', ');
    if (m !== null && m !== undefined) return String(m);
  }
  return null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, extractMessage(data) ?? `Request failed (${res.status})`, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  baseUrl: BASE_URL,
};
