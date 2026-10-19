import { create } from 'zustand'
import type { Language } from './i18n'
export type Session = { token?: string; user?: { id: string; display_name: string; roles: string[]; patient_id?: string }; demo: boolean }
type State = { language: Language; session: Session | null; online: boolean; lastSync: string | null; setLanguage: (l: Language) => void; setSession: (s: Session | null) => void; setOnline: (v: boolean) => void; setLastSync: (v: string | null) => void }
export const useAppStore = create<State>((set) => ({ language: 'en', session: null, online: true, lastSync: null, setLanguage: language => set({language}), setSession: session => set({session}), setOnline: online => set({online}), setLastSync: lastSync => set({lastSync}) }))
