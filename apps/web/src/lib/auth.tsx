import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Role } from '@m3/shared';
import { api, setAuthToken } from './api';

export interface AuthUser {
  userId: string;
  role: Role;
  workerId: string | null;
  contractorId: string | null;
  displayName: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loginWorker: (phone: string, pin: string) => Promise<AuthUser>;
  registerWorker: (input: { name: string; phone: string; pin: string; preferredLanguage: string }) => Promise<AuthUser>;
  loginStaff: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const STORAGE_KEY = 'm3.auth';
const AuthContext = createContext<AuthState | null>(null);

function load(): { token: string; user: AuthUser } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function save(data: { token: string; user: AuthUser } | null): void {
  try {
    if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const existing = load();
    if (existing) {
      setToken(existing.token);
      setUser(existing.user);
      setAuthToken(existing.token);
    }
  }, []);

  const apply = (res: { token: string; user: AuthUser }): AuthUser => {
    setToken(res.token);
    setUser(res.user);
    setAuthToken(res.token);
    save(res);
    return res.user;
  };

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      loginWorker: async (phone, pin) =>
        apply(await api.post('/auth/worker/login', { phone, pin })),
      registerWorker: async (input) =>
        apply(await api.post('/auth/worker/register', input)),
      loginStaff: async (username, password) =>
        apply(await api.post('/auth/staff/login', { username, password })),
      logout: () => {
        setToken(null);
        setUser(null);
        setAuthToken(null);
        save(null);
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
