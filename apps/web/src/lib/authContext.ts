import { createContext, useContext } from 'react';
import type { Role } from '@m3/shared';

export interface AuthUser {
  userId: string;
  role: Role;
  workerId: string | null;
  contractorId: string | null;
  displayName: string;
  credentialChangeRequired?: boolean;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loginWorker: (phone: string, pin: string) => Promise<AuthUser>;
  registerWorker: (input: { name: string; phone: string; pin: string; preferredLanguage: string }) => Promise<AuthUser>;
  loginStaff: (identifier: string, password: string) => Promise<AuthUser>;
  changeCredential: (newCredential: string, confirmCredential: string) => Promise<AuthUser>;
  logout: () => void;
}

export const STORAGE_KEY = 'm3.auth';

export const AuthContext = createContext<AuthState | null>(null);

export function load(): { token: string; user: AuthUser } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.user?.role === 'WORKER' || data?.user?.role === 'CONTRACTOR') {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function save(data: { token: string; user: AuthUser } | null): void {
  try {
    if (data && data.user.role !== 'WORKER' && data.user.role !== 'CONTRACTOR') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore storage errors */
  }
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
