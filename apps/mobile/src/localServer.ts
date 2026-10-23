/**
 * Standalone Local Server bridge.
 *
 * The Android app embeds the REAL FastAPI backend (Chaquopy CPython + uvicorn,
 * bound to 127.0.0.1 only — see docs/STANDALONE_LOCAL_SERVER.md). This bridge
 * exposes the native LocalServerModule to JavaScript with strict failure
 * typing so the sign-in screen can start the server and gate the API client
 * on an explicit readiness signal before any request is made.
 *
 * On non-Android platforms (web/tooling/node tests) every call resolves to a
 * deterministic "unavailable" result instead of touching NativeModules.
 */
import { NativeModules, Platform } from 'react-native'
import { LOCAL_SERVER_PORT } from './api'

export type LocalServerStatus =
  | { state: 'unavailable'; detail: string }
  | { state: 'idle' | 'starting' | 'ready' | 'stopped'; detail: string }
  | { state: 'failed'; detail: string }

type NativeModuleShape = {
  start(dataDir: string, port: number): Promise<boolean>
  stop(): Promise<boolean>
  reset(dataDir: string): Promise<number>
  status(): Promise<string>
}

function native(): NativeModuleShape | null {
  if (Platform.OS !== 'android') return null
  const mod = (NativeModules as Record<string, unknown>).M3LocalServer as
    | NativeModuleShape
    | undefined
  if (!mod || typeof mod.start !== 'function') return null
  return mod
}

export const localServerAvailable = (): boolean => native() !== null

/** Boot the embedded backend. Resolves once the Python server thread has been
 * launched (NOT the same thing as readiness — poll {@link localServerStatus}). */
export async function localServerStart(): Promise<void> {
  const mod = native()
  if (!mod) throw new Error('Local server runtime unavailable (native module missing)')
  await Promise.resolve(mod.start('', LOCAL_SERVER_PORT))
}

export async function localServerStop(): Promise<void> {
  const mod = native()
  if (!mod) return
  await Promise.resolve(mod.stop())
}

/** Delete the standalone local database. Resolves the number of deleted files.
 * Throws when the server is still running (the UI refuses while a session is
 * active; confirmed destruction happens only after an explicit dialog). */
export async function localServerReset(): Promise<number> {
  const mod = native()
  if (!mod) return 0
  return Promise.resolve(mod.reset(''))
}

/** One status sample from the Python-side state machine
 * ({status: idle|starting|ready|failed|stopped, detail}). */
export async function localServerStatus(): Promise<LocalServerStatus> {
  const mod = native()
  if (!mod) {
    return { state: 'unavailable', detail: 'Native module not available on this platform' }
  }
  try {
    const raw = String((await Promise.resolve(mod.status())) || '{}')
    const parsed = JSON.parse(raw) as { status?: string; detail?: string }
    const s = String(parsed.status || 'idle')
    if (s === 'ready') return { state: 'ready', detail: parsed.detail || '' }
    if (s === 'failed') return { state: 'failed', detail: parsed.detail || 'Unknown server error' }
    if (s === 'starting') return { state: 'starting', detail: parsed.detail || '' }
    if (s === 'stopped') return { state: 'stopped', detail: parsed.detail || '' }
    return { state: 'idle', detail: parsed.detail || '' }
  } catch (e) {
    return { state: 'failed', detail: e instanceof Error ? e.message : String(e) }
  }
}
