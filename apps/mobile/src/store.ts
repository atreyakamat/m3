import { create } from 'zustand'
import type { Language } from './i18n'
export type Session = { token?: string; user?: { id: string; display_name: string; phone_e164?: string; roles: string[]; patient_id?: string }; demo: boolean; local?: boolean }
type State = {
  language: Language
  session: Session | null
  online: boolean
  lastSync: string | null
  // Standalone Local Server mode (Phase 5): the tablet hosts the REAL backend.
  // Tracks the runtime lifecycle state for banners; the persisted switch lives
  // in cache_meta ('localMode') and is restored by src/api.ts initBaseUrl().
  localMode: boolean
  localServerReady: boolean
  setLocalMode: (v: boolean) => void
  setLocalServerReady: (v: boolean) => void
  // 401 session-degradation flag: set by src/api.ts when a request that carried
  // a token receives HTTP 401. The token is intentionally NOT cleared (drafts
  // and queued records stay usable); screens decide whether to sign out.
  sessionExpiredAt: number | null
  markSessionExpired: () => void
  clearSessionExpired: () => void
  // Task 1: runtime-configurable API target (LAN IP or public tunnel URL).
  customServerUrl: string | null
  setCustomServerUrl: (url: string | null) => void
  setLanguage: (l: Language) => void
  setSession: (s: Session | null) => void
  setOnline: (v: boolean) => void
  setLastSync: (v: string | null) => void
}
export const useAppStore = create<State>((set) => ({
  language: 'en',
  session: null,
  online: true,
  lastSync: null,
  localMode: false,
  localServerReady: false,
  setLocalMode: localMode => set({ localMode }),
  setLocalServerReady: localServerReady => set({ localServerReady }),
  sessionExpiredAt: null,
  markSessionExpired: () => set({ sessionExpiredAt: Date.now() }),
  clearSessionExpired: () => set({ sessionExpiredAt: null }),
  customServerUrl: null,
  setCustomServerUrl: (customServerUrl) => set({ customServerUrl }),
  setLanguage: language => set({language}),
  // A fresh session (sign-in / demo entry) invalidates any stale expiry flag;
  // signing out (null) also clears it so the banner never leaks across users.
  setSession: session => set({ session, sessionExpiredAt: null }),
  setOnline: online => set({online}),
  setLastSync: lastSync => set({lastSync}),
}))
