import * as SQLite from 'expo-sqlite'
const db = SQLite.openDatabaseSync('m3-cache.db')
export type CachedWorker = { id: string; patient_code: string; display_name?: string; age_years?: number; gender?: string; occupation?: string; consent_status?: string; initial_symptoms?: string[]; updated_at?: string }
export function initCache() { db.execSync('CREATE TABLE IF NOT EXISTS cache_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS cached_workers (owner_id TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(owner_id,id));') }
export function readWorkers(ownerId: string) { return db.getAllSync<{json:string}>('SELECT json FROM cached_workers WHERE owner_id = ? ORDER BY id', [ownerId]).map(r => JSON.parse(r.json) as CachedWorker) }
export function writeWorkers(ownerId: string, workers: CachedWorker[]) { db.withTransactionSync(() => { db.runSync('DELETE FROM cached_workers WHERE owner_id = ?', [ownerId]); for (const worker of workers) db.runSync('INSERT INTO cached_workers(owner_id,id,json) VALUES(?,?,?)', [ownerId, worker.id, JSON.stringify(worker)]); db.runSync("INSERT OR REPLACE INTO cache_meta(key,value) VALUES(?,?)", [`lastSync:${ownerId}`, new Date().toISOString()]) }) }
export function readLastSync(ownerId: string) { return db.getFirstSync<{value:string}>('SELECT value FROM cache_meta WHERE key=?', [`lastSync:${ownerId}`])?.value ?? null }
export function clearOwner(ownerId: string) { db.withTransactionSync(() => { db.runSync('DELETE FROM cached_workers WHERE owner_id=?', [ownerId]); db.runSync('DELETE FROM cache_meta WHERE key=?', [`lastSync:${ownerId}`]) }) }
export const DEMO_OWNER = 'synthetic-demo'
export const demoWorkers: CachedWorker[] = [{ id:'demo-worker-1', patient_code:'M3-SYN-7K2Q', display_name:'Synthetic Participant A', age_years:29, gender:'not_recorded', occupation:'construction', consent_status:'documented', initial_symptoms:['fever'], updated_at:'2026-10-19T09:00:00Z' }]
