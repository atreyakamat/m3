import * as SQLite from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

let _db: ExpoSQLiteDatabase<typeof schema> | null = null;

/** Create tables if they do not exist. Kept as idempotent raw DDL so the app
 *  works offline from first launch without a migration runner. */
const DDL = `
CREATE TABLE IF NOT EXISTS screening_draft (
  id TEXT PRIMARY KEY NOT NULL,
  answers TEXT NOT NULL DEFAULT '{}',
  consent_given INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  sync_state TEXT NOT NULL DEFAULT 'LOCAL',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS symptom_report (
  id TEXT PRIMARY KEY NOT NULL,
  symptoms TEXT NOT NULL DEFAULT '[]',
  note TEXT,
  idempotency_key TEXT NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS follow_up_response (
  id TEXT PRIMARY KEY NOT NULL,
  follow_up_id TEXT NOT NULL,
  response TEXT NOT NULL,
  note TEXT,
  idempotency_key TEXT NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  local_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

export function getDb(): ExpoSQLiteDatabase<typeof schema> {
  if (!_db) {
    const native = SQLite.openDatabaseSync('m3.db');
    native.execSync(DDL);
    _db = drizzle(native, { schema });
  }
  return _db;
}

export { schema };
