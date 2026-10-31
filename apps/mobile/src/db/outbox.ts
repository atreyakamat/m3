import { eq, or } from 'drizzle-orm';
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
    const idempotencyKey = input.idempotencyKey ?? uuid();

    // Prevent duplicate pending entries for the same idempotency key
    const existing = db
      .select()
      .from(outbox)
      .where(eq(outbox.idempotencyKey, idempotencyKey))
      .all();
    if (existing.length > 0) {
      const row = existing[0];
      if (row.syncState === 'PENDING') {
        db.update(outbox)
          .set({ payload: JSON.stringify(input.payload) })
          .where(eq(outbox.id, row.id))
          .run();
        return { ...row, payload: JSON.stringify(input.payload) } as OutboxRow;
      }
    }

    const row = {
      id: uuid(),
      entityType: input.entityType,
      localId: input.localId,
      payload: JSON.stringify(input.payload),
      idempotencyKey,
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

  pendingOrFailed(): OutboxRow[] {
    return getDb()
      .select()
      .from(outbox)
      .where(or(eq(outbox.syncState, 'PENDING'), eq(outbox.syncState, 'FAILED')))
      .all();
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
