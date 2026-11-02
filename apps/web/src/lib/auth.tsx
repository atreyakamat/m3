import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAuthToken } from './api';
import { AuthContext, load, save, type AuthState, type AuthUser } from './authContext';

export type { AuthState, AuthUser } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restore the persisted session synchronously so the first render already
  // reflects it — no setState-in-effect hydration cascade.
  const [restored] = useState(load);
  const [token, setToken] = useState<string | null>(restored?.token ?? null);
  const [user, setUser] = useState<AuthUser | null>(restored?.user ?? null);

  // Keep the api module's auth header in sync with the current token.
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const value = useMemo<AuthState>(() => {
    const apply = (res: { token: string; user: AuthUser }): AuthUser => {
      setToken(res.token);
      setUser(res.user);
      setAuthToken(res.token);
      save(res);
      return res.user;
    };
    return {
      token,
      user,
      loginWorker: async (phone, pin) =>
        apply(await api.post('/auth/worker/login', { phone, pin })),
      registerWorker: async (input) =>
        apply(await api.post('/auth/worker/register', input)),
      loginStaff: async (username, password) =>
        apply(await api.post('/auth/staff/login', { username, password })),
      changeCredential: async (newCredential, confirmCredential) => {
        const c = await apply(await api.post('/auth/change-credential', { newCredential, confirmCredential }));
        return c;
      },
      logout: () => {
        setToken(null);
        setUser(null);
        setAuthToken(null);
        save(null);
      },
    };
  }, [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
