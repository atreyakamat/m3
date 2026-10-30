import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Local SQLite schema (Drizzle). Holds worker-side drafts/records plus a
 * sync-ready outbox. Each row carries an explicit sync state so the UI never
 * shows a local-only record as server-confirmed.
 */

export const screeningDraft = sqliteTable('screening_draft', {
  id: text('id').primaryKey(),
  answers: text('answers').notNull().default('{}'),
  consentGiven: integer('consent_given', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('DRAFT'), // DRAFT | COMPLETE (local)
  syncState: text('sync_state').notNull().default('LOCAL'),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const symptomReport = sqliteTable('symptom_report', {
  id: text('id').primaryKey(),
  symptoms: text('symptoms').notNull().default('[]'),
  note: text('note'),
  idempotencyKey: text('idempotency_key').notNull(),
  syncState: text('sync_state').notNull().default('PENDING'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const followUpResponse = sqliteTable('follow_up_response', {
  id: text('id').primaryKey(),
  followUpId: text('follow_up_id').notNull(),
  response: text('response').notNull(),
  note: text('note'),
  idempotencyKey: text('idempotency_key').notNull(),
  syncState: text('sync_state').notNull().default('PENDING'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/** Generic outbox for queued server mutations. */
export const outbox = sqliteTable('outbox', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(), // symptom_report | follow_up_response | screening
  localId: text('local_id').notNull(),
  payload: text('payload').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  syncState: text('sync_state').notNull().default('PENDING'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type OutboxRow = typeof outbox.$inferSelect;
export type SymptomReportRow = typeof symptomReport.$inferSelect;
