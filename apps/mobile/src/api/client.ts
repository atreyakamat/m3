import Constants from 'expo-constants';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function baseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
    'http://10.0.2.2:8003/api/v1'
  );
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    // Network failure — surfaced so callers can fall back to offline behaviour.
    throw new ApiError(0, 'network_error', err);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'message' in data
        ? String((data as Record<string, unknown>).message)
        : res.statusText) || 'request_failed';
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const isNetworkError = (e: unknown): boolean => e instanceof ApiError && e.status === 0;
