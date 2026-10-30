import { eq } from 'drizzle-orm';
import type { SyncState } from '@m3/shared';
import { getDb } from './client';
import { outbox, type OutboxRow } from './schema';

function uuid(): string {
  // RFC4122-ish v4 without extra deps.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface EnqueueInput {
  entityType: string;
  localId: string;
  payload: Record<string, unknown>;
  /** Reuse an idempotency key so a retried request never duplicates server-side. */
  idempotencyKey?: string;
}

export const outboxRepo = {
  enqueue(input: EnqueueInput): OutboxRow {
    const db = getDb();
    const row = {
      id: uuid(),
      entityType: input.entityType,
      localId: input.localId,
      payload: JSON.stringify(input.payload),
      idempotencyKey: input.idempotencyKey ?? uuid(),
      syncState: 'PENDING' as SyncState,
      attempts: 0,
      lastError: null,
    };
    db.insert(outbox).values(row).run();
    return row as OutboxRow;
  },

  pending(): OutboxRow[] {
    return getDb().select().from(outbox).where(eq(outbox.syncState, 'PENDING')).all();
  },

  failed(): OutboxRow[] {
    return getDb().select().from(outbox).where(eq(outbox.syncState, 'FAILED')).all();
  },

  markSynced(id: string): void {
    getDb().update(outbox).set({ syncState: 'SYNCED' }).where(eq(outbox.id, id)).run();
  },

  markFailed(id: string, error: string, attempts: number): void {
    getDb()
      .update(outbox)
      .set({ syncState: 'FAILED', lastError: error, attempts })
      .where(eq(outbox.id, id))
      .run();
  },

  requeue(id: string): void {
    getDb().update(outbox).set({ syncState: 'PENDING' }).where(eq(outbox.id, id)).run();
  },
};

export { uuid };
