/**
 * Offline Demo Mode — isolated local persistence.
 *
 * ISOLATION BOUNDARY (mandatory safety property):
 *  - Native: a SEPARATE SQLite database file (`m3-demo.db`), never `m3-cache.db`.
 *    The real store's tables (cached_workers, local_drafts, outbox, cache_meta)
 *    are unreachable from here.
 *  - Web/tests: `m3demo:`-prefixed localStorage keys, never the real `m3:*` keys.
 *  - No function in this module can call the network layer; demo writes are
 *    captured with an explicit `demo_saved_locally` status and there is no
 *    upload path — no outbox enqueue, no idempotency key, no replay.
 *
 * The backend keeps a tiny synchronous key/value contract so the demo store
 * degrades to a silent no-op exactly like src/cache.ts when storage is
 * unavailable (a storage outage must never block a demo screen).
 */

export type DemoRecordKind =
  | 'questionnaire_submit'
  | 'symptom_report'
  | 'assessment'
  | 'diagnostic'
  | 'slide_followup'
  | 'followup'

export type DemoRecord = {
  id: string
  kind: DemoRecordKind
  label: string
  status: 'demo_saved_locally'
  created_at: string
  payload: unknown
}

export type DemoActivity = {
  id: string
  at: string
  label: string
  detail: string
}

export type DemoDraftRow = {
  owner_id: string
  json: string
  updated_at: string
}

interface DemoBackend {
  get(key: string): string | null
  set(key: string, value: string): void
  del(key: string): void
  keys(): string[]
}

function webBackend(): DemoBackend {
  const W = typeof window !== 'undefined' ? window : (globalThis as any)
  const ls: Storage = W.localStorage
  const PREFIX = 'm3demo:'
  return {
    get(k) { try { return ls.getItem(PREFIX + k) } catch { return null } },
    set(k, v) { try { ls.setItem(PREFIX + k, v) } catch { /* quota: lost */ } },
    del(k) { try { ls.removeItem(PREFIX + k) } catch { /* noop */ } },
    keys() {
      const out: string[] = []
      try {
        for (let i = 0; i < ls.length; i++) {
          const key = ls.key(i)
          if (key && key.startsWith(PREFIX)) out.push(key.slice(PREFIX.length))
        }
      } catch { /* noop */ }
      return out
    },
  }
}

interface SqlBackend {
  execSync(sql: string): void
  runSync(sql: string, params: any[]): void
  getFirstSync<T>(sql: string, params: any[]): T | undefined
  getAllSync<T>(sql: string, params: any[]): T[]
}

/** Native: a dedicated demo SQLite file. expo-sqlite is required lazily so web
 * bundles and node tests never load the native module. */
function nativeBackend(): DemoBackend {
  // Lazily required so web bundles and node test runs never load the native
  // SQLite module (kept out of static imports for that exact reason).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLite = require('expo-sqlite')
  let db: SqlBackend
  try {
    db = SQLite.openDatabaseSync('m3-demo.db')
    db.execSync('CREATE TABLE IF NOT EXISTS demo_kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)')
  } catch {
    return noopBackend()
  }
  return {
    get(k) { return db.getFirstSync<{ value: string }>('SELECT value FROM demo_kv WHERE key=?', [k])?.value ?? null },
    set(k, v) { db.runSync('INSERT OR REPLACE INTO demo_kv(key,value) VALUES(?,?)', [k, v]) },
    del(k) { db.runSync('DELETE FROM demo_kv WHERE key=?', [k]) },
    keys() {
      try {
        return db.getAllSync<{ key: string }>('SELECT key FROM demo_kv', []).map((r) => r.key)
      } catch {
        return []
      }
    },
  }
}

function noopBackend(): DemoBackend {
  return { get: () => null, set: () => {}, del: () => {}, keys: () => [] }
}

let backend: DemoBackend | null = null
function store(): DemoBackend {
  if (backend) return backend
  try {
    // Environment detection without a react-native import: native Hermes has
    // no global `localStorage`, while react-native-web, browsers and node test
    // harnesses do. Web/tests never trigger the lazy native require.
    backend = hasDomStorage() ? webBackend() : nativeBackend()
  } catch {
    backend = noopBackend()
  }
  return backend
}

function hasDomStorage(): boolean {
  try {
    return typeof (globalThis as any).localStorage?.getItem === 'function'
  } catch {
    return false
  }
}

export function initDemoStore() {
  store() // materialize + (native) create table
}

// --- meta (persisted demo-session marker; the active role) ------------------

export function getDemoMeta(key: string): string | null {
  return store().get(`meta:${key}`)
}

export function setDemoMeta(key: string, value: string) {
  store().set(`meta:${key}`, value)
}

export function deleteDemoMeta(key: string) {
  store().del(`meta:${key}`)
}

/** The persisted demo role lets a demo session survive an app restart without
 * touching any real-session storage. null = no active demo session. */
export function getActiveDemoRole(): string | null {
  return getDemoMeta('activeRole')
}

export function setActiveDemoRole(role: string | null) {
  if (role) setDemoMeta('activeRole', role)
  else deleteDemoMeta('activeRole')
}

// --- demo drafts ------------------------------------------------------------

function draftKey(ownerId: string) {
  return `draft:${ownerId}`
}

export function saveDemoDraft(ownerId: string, data: unknown) {
  const updatedAt = new Date().toISOString()
  const stamped = data && typeof data === 'object' ? { ...(data as any), updated_at: updatedAt } : { updated_at: updatedAt }
  store().set(draftKey(ownerId), JSON.stringify({ json: JSON.stringify(stamped), updated_at: updatedAt }))
}

export function readDemoDraft(ownerId: string): any | null {
  const raw = store().get(draftKey(ownerId))
  if (!raw) return null
  try {
    const row = JSON.parse(raw)
    return JSON.parse(row.json)
  } catch {
    return null
  }
}

export function readDemoDraftUpdatedAt(ownerId: string): string | null {
  const raw = store().get(draftKey(ownerId))
  if (!raw) return null
  try {
    return JSON.parse(raw).updated_at ?? null
  } catch {
    return null
  }
}

export function deleteDemoDraft(ownerId: string) {
  store().del(draftKey(ownerId))
}

export function listDemoDrafts(): DemoDraftRow[] {
  return store()
    .keys()
    .filter((k) => k.startsWith('draft:'))
    .map((k) => {
      const ownerId = k.slice('draft:'.length)
      try {
        const row = JSON.parse(store().get(k) || '{}')
        return { owner_id: ownerId, json: row.json, updated_at: row.updated_at }
      } catch {
        return { owner_id: ownerId, json: '', updated_at: '' }
      }
    })
    .filter((r) => r.json)
}

// --- demo records (synthetic "submissions") ---------------------------------

const MAX_RECORDS = 200
const RECORDS_KEY = 'records'

export function saveDemoRecord(input: {
  kind: DemoRecordKind
  label: string
  payload: unknown
}): DemoRecord {
  const id = `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const record: DemoRecord = {
    id,
    kind: input.kind,
    label: input.label,
    status: 'demo_saved_locally',
    created_at: new Date().toISOString(),
    payload: input.payload,
  }
  const records = listDemoRecords()
  records.unshift(record)
  store().set(RECORDS_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)))
  saveDemoActivity(`Saved demo ${input.kind.replace(/_/g, ' ')}`, `${input.label} — stored on this device only, never sent to any server.`)
  return record
}

export function createDemoRecordId(): string {
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function listDemoRecords(kind?: DemoRecordKind): DemoRecord[] {
  const raw = store().get(RECORDS_KEY)
  if (!raw) return []
  try {
    const records = JSON.parse(raw) as DemoRecord[]
    return kind ? records.filter((r) => r.kind === kind) : records
  } catch {
    return []
  }
}

// --- demo activity history ---------------------------------------------------

const MAX_ACTIVITY = 100
const ACTIVITY_KEY = 'activity'

export function saveDemoActivity(label: string, detail: string) {
  const activity = listDemoActivity()
  activity.unshift({ id: createDemoRecordId(), at: new Date().toISOString(), label, detail })
  store().set(ACTIVITY_KEY, JSON.stringify(activity.slice(0, MAX_ACTIVITY)))
}

export function listDemoActivity(): DemoActivity[] {
  const raw = store().get(ACTIVITY_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as DemoActivity[]
  } catch {
    return []
  }
}

// --- reset -------------------------------------------------------------------

/** Wipe the ENTIRE demo namespace (drafts, records, activity, session marker).
 * Real-data storage (m3-cache.db tables, token keystore) is untouched by
 * construction — this backend cannot address it. */
export function resetDemoData() {
  const s = store()
  for (const key of s.keys()) s.del(key)
}
