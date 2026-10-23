import * as SQLite from 'expo-sqlite'
import { Platform } from 'react-native'
export type CachedWorker = {
  id: string; patient_code: string; display_name?: string; age_years?: number; gender?: string; occupation?: string
  consent_status?: string; initial_symptoms?: string[]; updated_at?: string
  // Task 4/5: searchable identity attributes + single-screening state.
  phone_e164?: string; nativity?: string; screening_completed?: boolean; screened_at?: string | null
}

// ---------------------------------------------------------------------------
// Storage backend dispatch. expo-sqlite sync APIs are NOT supported on web
// (module-level openDatabaseSync previously crashed the whole bundle before
// any screen rendered). Native keeps the real SQLite file byte-for-byte; web
// uses a localStorage-backed shim implementing exactly the statement set used
// below, so behavior (drafts, outbox, pending idempotency keys) is preserved.
// ---------------------------------------------------------------------------

interface CacheDb {
  execSync(sql: string): void
  runSync(sql: string, params: any[]): void
  getAllSync<T>(sql: string, params: any[]): T[]
  getFirstSync<T>(sql: string, params: any[]): T | undefined
  withTransactionSync(fn: () => void): void
}

function webBackend(): CacheDb {
  const W = typeof window !== 'undefined' ? window : (globalThis as any)
  const ls: Storage = W.localStorage
  const norm = (sql: string): string => sql.replace(/\s+/g, ' ').trim()
  const store = {
    set(k: string, v: string) { try { ls.setItem(k, v) } catch { /* quota */ } },
    get(k: string): string | null { try { return ls.getItem(k) } catch { return null } },
    del(k: string) { try { ls.removeItem(k) } catch { /* ignore */ } },
  }
  const keyFix = (sql: string): string => {
    const n = norm(sql)
    if (n.startsWith('SELECT json FROM cached_workers')) return 'workers_get'
    if (n.startsWith('DELETE FROM cached_workers')) return 'workers_del'
    if (n.startsWith('INSERT INTO cached_workers')) return 'workers_ins'
    if (n.startsWith('INSERT OR REPLACE INTO cache_meta')) return 'meta_set'
    if (n.startsWith('SELECT value FROM cache_meta')) return 'meta_get'
    if (n.startsWith('DELETE FROM cache_meta WHERE key=? AND value=?')) return 'meta_del_guard'
    if (n.startsWith('DELETE FROM cache_meta')) return 'meta_del'
    if (n.startsWith('INSERT OR REPLACE INTO local_drafts')) return 'draft_set'
    if (n.startsWith('SELECT json FROM local_drafts')) return 'draft_get'
    if (n.startsWith('DELETE FROM local_drafts')) return 'draft_del'
    if (n.startsWith('INSERT INTO outbox')) return 'outbox_ins'
    if (n.startsWith('UPDATE outbox SET')) return 'outbox_set'
    if (n.startsWith('SELECT * FROM outbox')) return 'outbox_get'
    if (n.startsWith('SELECT COUNT(*) as count FROM outbox')) return 'outbox_count'
    if (n.startsWith('DELETE FROM outbox')) return 'outbox_del'
    return sql.slice(0, 40)
  }
  return {
    execSync() {
      // CREATE TABLE statements are no-ops for the structured web store.
    },
    runSync(sql: string, params: any[]) {
      switch (keyFix(sql)) {
        case 'workers_ins': {
          const [ownerId, id, json] = params as [string, string, string]
          const k = `m3:worker:${ownerId}`
          const rec = JSON.parse(store.get(k) || '{}')
          rec[id] = json
          store.set(k, JSON.stringify(rec))
          break
        }
        case 'workers_del': {
          store.del(`m3:worker:${params[0]}`)
          break
        }
        case 'meta_set': {
          const [k, v] = params as [string, string]
          store.set(`m3:meta:${k}`, v)
          break
        }
        case 'meta_del_guard': {
          const [k, v] = params as [string, string]
          const mk = `m3:meta:${k}`
          if (store.get(mk) === v) store.del(mk)
          break
        }
        case 'meta_del': {
          store.del(`m3:meta:${params[0]}`)
          break
        }
        case 'draft_set': {
          const [ownerId, json, at] = params as [string, string, string]
          store.set(`m3:draft:${ownerId}`, JSON.stringify({ json, updated_at: at }))
          break
        }
        case 'draft_del': {
          store.del(`m3:draft:${params[0]}`)
          break
        }
        case 'outbox_ins': {
          const [id, ownerId, created_at, status, attempts, last_error, kind, payload] =
            params as [string, string, string, string, number, string | null, string, string]
          const k = `m3:outbox:${ownerId}`
          const rec = JSON.parse(store.get(k) || '{}')
          rec[id] = { id, owner_id: ownerId, created_at, status, attempts, last_error, kind, payload }
          store.set(k, JSON.stringify(rec))
          break
        }
        case 'outbox_set': {
          const [status, error, delta, id] = params as [string, string | null, number, string]
          for (const ownerKey of Object.keys(W.localStorage || {})) {
            if (!ownerKey.startsWith('m3:outbox:')) continue
            const rec = JSON.parse(store.get(ownerKey) || '{}')
            if (!rec[id]) continue
            rec[id] = { ...rec[id], status, last_error: error ?? null, attempts: (rec[id].attempts ?? 0) + delta }
            store.set(ownerKey, JSON.stringify(rec))
            break
          }
          break
        }
        case 'outbox_del': {
          const delId = String(params[0])
          for (const ownerKey of Object.keys(W.localStorage || {})) {
            if (!ownerKey.startsWith('m3:outbox:')) continue
            const rec = JSON.parse(store.get(ownerKey) || '{}')
            if (!rec[delId]) continue
            delete rec[delId]
            store.set(ownerKey, JSON.stringify(rec))
            break
          }
          break
        }
        default:
          throw new Error(`Unsupported cache statement on web: ${norm(sql).slice(0, 60)}`)
      }
    },
    getAllSync<T>(sql: string, params: any[]) {
      switch (keyFix(sql)) {
        case 'workers_get': {
          const rec = JSON.parse(store.get(`m3:worker:${params[0]}`) || '{}') as Record<string, string>
          return Object.keys(rec).sort().map((id) => ({ json: rec[id] })) as T[]
        }
        case 'outbox_get': {
          const rec = JSON.parse(store.get(`m3:outbox:${params[0]}`) || '{}') as Record<string, any>
          return Object.values(rec).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)) as T[]
        }
        case 'outbox_count': {
          return [] as T[]
        }
        default:
          throw new Error(`Unsupported cache query on web: ${norm(sql).slice(0, 60)}`)
      }
    },
    getFirstSync<T>(sql: string, params: any[]) {
      switch (keyFix(sql)) {
        case 'meta_get': {
          const v = store.get(`m3:meta:${params[0]}`)
          return (v === null ? undefined : { value: v }) as T | undefined
        }
        case 'draft_get': {
          const raw = store.get(`m3:draft:${params[0]}`)
          return (raw === null ? undefined : { json: JSON.parse(raw).json }) as T | undefined
        }
        case 'outbox_count': {
          const [ownerId, hasStatus] = [params[0], params[1]]
          const sqlNorm = norm(sql)
          const rec = JSON.parse(store.get(`m3:outbox:${ownerId}`) || '{}') as Record<string, any>
          let n = 0
          for (const item of Object.values(rec)) {
            if (sqlNorm.includes('AND status = ?') && item.status !== hasStatus) continue
            n += 1
          }
          return { count: n } as T
        }
        default:
          throw new Error(`Unsupported cache scalar query on web: ${keyFix(sql)}`)
      }
    },
    withTransactionSync(fn) { fn() }, // localStorage is synchronous; atomicity is acceptable for cache scope
  }
}

// A backend that silently no-ops: applied when no storage is available so a
// storage outage can never block rendering or crash form flows (data written
// while degraded is simply not retained; imports still mount).
function noopBackend(): CacheDb {
  return {
    execSync() {},
    runSync() {},
    getAllSync<T>(): T[] { return [] },
    getFirstSync<T>(): T | undefined { return undefined },
    withTransactionSync(fn) { fn() },
  }
}

let db: CacheDb
if (Platform.OS === 'web') {
  db = webBackend()
} else {
  try {
    db = SQLite.openDatabaseSync('m3-cache.db')
  } catch (err) {
    // Never let storage availability block the UI: degrade to no-cache.
    db = noopBackend()
  }
}

export function initCache() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS cache_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cached_workers (owner_id TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(owner_id,id));
    CREATE TABLE IF NOT EXISTS local_drafts (owner_id TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL);
  `)
}

// --- Generic synchronous key/value meta store (Task 1/3: server URL, tour flag) ---
// Backed by cache_meta: SQLite on native, localStorage on web. Both remain
// readable synchronously, so the API base URL can be resolved at module load.
// Wrapped in try/catch: before initCache() runs (or when storage degrades) the
// helpers no-op instead of crashing module imports.

export function readMeta(key: string): string | null {
  try {
    if (!db) return null
    return db.getFirstSync<{ value: string }>('SELECT value FROM cache_meta WHERE key=?', [key])?.value ?? null
  } catch {
    return null
  }
}

export function writeMeta(key: string, value: string) {
  try {
    db.runSync('INSERT OR REPLACE INTO cache_meta(key,value) VALUES(?,?)', [key, value])
  } catch { /* storage outage: value not retained */ }
}

export function deleteMeta(key: string) {
  try {
    db.runSync('DELETE FROM cache_meta WHERE key=?', [key])
  } catch { /* storage outage: noop */ }
}

export function readWorkers(ownerId: string) {
  return db.getAllSync<{json:string}>('SELECT json FROM cached_workers WHERE owner_id = ? ORDER BY id', [ownerId]).map(r => JSON.parse(r.json) as CachedWorker)
}

export function writeWorkers(ownerId: string, workers: CachedWorker[]) {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM cached_workers WHERE owner_id = ?', [ownerId])
    for (const worker of workers) db.runSync('INSERT INTO cached_workers(owner_id,id,json) VALUES(?,?,?)', [ownerId, worker.id, JSON.stringify(worker)])
    db.runSync("INSERT OR REPLACE INTO cache_meta(key,value) VALUES(?,?)", [`lastSync:${ownerId}`, new Date().toISOString()])
  })
}

export function readLastSync(ownerId: string) {
  return db.getFirstSync<{value:string}>('SELECT value FROM cache_meta WHERE key=?', [`lastSync:${ownerId}`])?.value ?? null
}

export function clearOwner(ownerId: string) {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM cached_workers WHERE owner_id=?', [ownerId])
    db.runSync('DELETE FROM cache_meta WHERE key=?', [`lastSync:${ownerId}`])
    // Note: local_drafts is intentionally PRESERVED so in-progress field screenings
    // are not lost on logout/session expiry (PRD offline draft retention requirement).
  })
}

export function saveDraft(ownerId: string, data: any) {
  // Stamp the draft with its own save timestamp so the intake screen can apply
  // the newer-wins conflict policy against the server draft. The row's
  // updated_at column carries the same value; the JSON shape is otherwise
  // identical to what was passed in.
  const updatedAt = new Date().toISOString()
  const stamped = data && typeof data === 'object' ? { ...data, updated_at: updatedAt } : { updated_at: updatedAt }
  const jsonStr = JSON.stringify(stamped)
  db.runSync(
    'INSERT OR REPLACE INTO local_drafts(owner_id, json, updated_at) VALUES(?, ?, ?)',
    [ownerId, jsonStr, updatedAt]
  )
}

export function readDraft(ownerId: string): any | null {
  const row = db.getFirstSync<{ json: string }>('SELECT json FROM local_drafts WHERE owner_id = ?', [ownerId])
  if (!row) return null
  try {
    return JSON.parse(row.json)
  } catch {
    return null
  }
}

export function deleteDraft(ownerId: string) {
  db.runSync('DELETE FROM local_drafts WHERE owner_id = ?', [ownerId])
}

// --- Outbox: durable queue for writes made offline (PRD section 12) ---
// One row per queued logical write. Each item carries its own idempotency key
// (client_request_id), so a replayed delivery can never create a duplicate.
// State machine: queued -> synced (removed) | failed (kept, recoverable).

function ensureOutbox() {
  db.execSync(`CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL
  );`)
}

export type OutboxKind = 'questionnaire_submit' | 'worker_register' | 'symptom_report'
export type OutboxStatus =
  | 'queued'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'retryable_error'
  | 'permanent_error'
  | 'authentication_required'
  | 'conflict_requires_review'
export type OutboxItem = {
  id: string; owner_id: string; created_at: string; status: OutboxStatus; attempts: number; last_error: string | null; kind: OutboxKind; payload: any
}

export function enqueueOutbox(ownerId: string, kind: OutboxKind, payload: any): OutboxItem {
  ensureOutbox()
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const item: OutboxItem = { id, owner_id: ownerId, created_at: new Date().toISOString(), status: 'queued', attempts: 0, last_error: null, kind, payload }
  db.runSync('INSERT INTO outbox(id, owner_id, created_at, status, attempts, last_error, kind, payload) VALUES(?,?,?,?,?,?,?,?)',
    [id, ownerId, item.created_at, 'queued', 0, null, kind, JSON.stringify(payload)])
  return item
}

export function setOutboxStatus(id: string, status: OutboxStatus, error: string | null = null, attemptsDelta = 0) {
  ensureOutbox()
  db.runSync('UPDATE outbox SET status = ?, last_error = ?, attempts = attempts + ? WHERE id = ?',
    [status, error ?? null, attemptsDelta, id])
}

export function readOutbox(ownerId: string): OutboxItem[] {
  ensureOutbox()
  return db.getAllSync<{ id: string; owner_id: string; created_at: string; status: string; attempts: number; last_error: string | null; kind: string; payload: string }>(
    'SELECT * FROM outbox WHERE owner_id = ? ORDER BY created_at', [ownerId])
    .map((r) => ({
      id: r.id, owner_id: r.owner_id, created_at: r.created_at,
      status: (r.status as OutboxStatus) || 'queued', attempts: r.attempts, last_error: r.last_error,
      kind: r.kind as OutboxKind, payload: safeParse(r.payload),
    }))
    .filter((r) => r.payload !== null)
}

export function outboxCount(ownerId: string, status?: OutboxStatus): number {
  ensureOutbox()
  if (status) {
    return db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM outbox WHERE owner_id = ? AND status = ?', [ownerId, status])?.count ?? 0
  }
  return db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM outbox WHERE owner_id = ?', [ownerId])?.count ?? 0
}

export function isAuthError(message: string): boolean {
  return /authentication required/i.test(message)
}

// --- Pending submission idempotency key (PRD SCR-006/OFF-003) ---
// One pending client_request_id per owner per logical write purpose ('screening'
// questionnaire submission, 'symptom_report', ...). Minted once for a logical
// submission attempt and reused across repeated Submit presses, network
// retries with ambiguous outcomes, and outbox replay, until the server
// authoritatively acknowledges that attempt. Keyed by owner so accounts can
// never adopt each other's pending IDs; purposes never collide; survives app
// restarts and logout (clearOwner only removes this owner's worker cache +
// lastSync stamp; the pending key follows the same retention policy as
// local_drafts).

export type PendingPurpose = 'questionnaire' | 'symptom_report'

function pendingKey(ownerId: string, purpose: PendingPurpose): string {
  return purpose === 'questionnaire' ? `pendingSubmission:${ownerId}` : `pendingSubmission:${purpose}:${ownerId}`
}

export function getPendingRequestId(ownerId: string, purpose: PendingPurpose = 'questionnaire'): string | null {
  return db.getFirstSync<{ value: string }>('SELECT value FROM cache_meta WHERE key=?', [
    pendingKey(ownerId, purpose),
  ])?.value ?? null
}

export function setPendingRequestId(ownerId: string, requestId: string, purpose: PendingPurpose = 'questionnaire') {
  db.runSync('INSERT OR REPLACE INTO cache_meta(key,value) VALUES(?,?)', [
    pendingKey(ownerId, purpose), requestId,
  ])
}

export function clearPendingRequestId(ownerId: string, expectedId?: string | null, purpose: PendingPurpose = 'questionnaire') {
  const key = pendingKey(ownerId, purpose)
  if (expectedId) {
    db.runSync('DELETE FROM cache_meta WHERE key=? AND value=?', [key, expectedId])
    return
  }
  db.runSync('DELETE FROM cache_meta WHERE key=?', [key])
}

export function removeOutbox(id: string) {
  ensureOutbox()
  db.runSync('DELETE FROM outbox WHERE id = ?', [id])
}

function safeParse(json: string): any | null {
  try { return JSON.parse(json) } catch { return null }
}

export const DEMO_OWNER = 'synthetic-demo'
export const demoWorkers: CachedWorker[] = [{ id:'demo-worker-1', patient_code:'M3-SYN-7K2Q', display_name:'Synthetic Participant A', age_years:29, gender:'not_recorded', occupation:'construction', consent_status:'documented', initial_symptoms:['fever'], updated_at:'2026-10-19T09:00:00Z' }]

