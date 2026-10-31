/**
 * Local SQLite storage repository for Worker Initial Screening.
 *
 * Provides:
 * - Local draft persistence (survives app restart / unexpected close).
 * - Offline completion queueing via outbox.
 * - Idempotent sync tracking (LOCAL -> PENDING -> SYNCED).
 */

import { eq } from 'drizzle-orm';
import type { SyncState } from '@m3/shared';
import { getDb } from '@/db/client';
import { screeningDraft, type OutboxRow } from '@/db/schema';
import { outboxRepo, uuid } from '@/db/outbox';

export interface LocalScreeningRecord {
  id: string;
  answers: Record<string, unknown>;
  consentGiven: boolean;
  status: 'DRAFT' | 'COMPLETE';
  syncState: SyncState;
  updatedAt: string;
}

export const screeningLocalRepo = {
  /** Retrieve locally stored draft or record for a worker */
  getLocal(workerId: string): LocalScreeningRecord | null {
    try {
      const db = getDb();
      const rows = db.select().from(screeningDraft).where(eq(screeningDraft.id, workerId)).all();
      if (!rows.length) return null;
      const row = rows[0];
      return {
        id: row.id,
        answers: JSON.parse(row.answers || '{}'),
        consentGiven: Boolean(row.consentGiven),
        status: row.status as 'DRAFT' | 'COMPLETE',
        syncState: row.syncState as SyncState,
        updatedAt: row.updatedAt,
      };
    } catch {
      return null;
    }
  },

  /** Save draft to SQLite */
  saveDraft(
    workerId: string,
    answers: Record<string, unknown>,
    consentGiven: boolean,
    syncState: SyncState = 'LOCAL',
  ): void {
    try {
      const db = getDb();
      const existing = db.select().from(screeningDraft).where(eq(screeningDraft.id, workerId)).all();
      const payload = {
        answers: JSON.stringify(answers),
        consentGiven,
        status: 'DRAFT',
        syncState,
        updatedAt: new Date().toISOString(),
      };

      if (existing.length > 0) {
        db.update(screeningDraft).set(payload).where(eq(screeningDraft.id, workerId)).run();
      } else {
        db.insert(screeningDraft).values({ id: workerId, ...payload }).run();
      }
    } catch (err) {
      console.warn('Failed to save screening draft locally', err);
    }
  },

  /** Complete screening locally and queue to outbox for offline support */
  completeLocally(
    workerId: string,
    answers: Record<string, unknown>,
  ): OutboxRow | null {
    try {
      const db = getDb();
      const existing = db.select().from(screeningDraft).where(eq(screeningDraft.id, workerId)).all();
      const payload = {
        answers: JSON.stringify(answers),
        consentGiven: true,
        status: 'COMPLETE',
        syncState: 'PENDING' as SyncState,
        updatedAt: new Date().toISOString(),
      };

      if (existing.length > 0) {
        db.update(screeningDraft).set(payload).where(eq(screeningDraft.id, workerId)).run();
      } else {
        db.insert(screeningDraft).values({ id: workerId, ...payload }).run();
      }

      // Enqueue to outbox with idempotent localId
      return outboxRepo.enqueue({
        entityType: 'screening',
        localId: workerId,
        payload: { answers, consentGiven: true },
        idempotencyKey: `screening_${workerId}`,
      });
    } catch (err) {
      console.warn('Failed to complete screening locally', err);
      return null;
    }
  },

  /** Mark local screening record as SYNCED with server */
  markSynced(workerId: string): void {
    try {
      const db = getDb();
      db.update(screeningDraft)
        .set({ syncState: 'SYNCED' as SyncState, updatedAt: new Date().toISOString() })
        .where(eq(screeningDraft.id, workerId))
        .run();
    } catch (err) {
      console.warn('Failed to mark screening synced', err);
    }
  },
};
