import { create } from 'zustand'
import type { Language } from './i18n'
export type Session = { token?: string; user?: { id: string; display_name: string; phone_e164?: string; roles: string[]; patient_id?: string }; demo: boolean }
type State = {
  language: Language
  session: Session | null
  online: boolean
  lastSync: string | null
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
  customServerUrl: null,
  setCustomServerUrl: (customServerUrl) => set({ customServerUrl }),
  setLanguage: language => set({language}),
  setSession: session => set({session}),
  setOnline: online => set({online}),
  setLastSync: lastSync => set({lastSync}),
}))
