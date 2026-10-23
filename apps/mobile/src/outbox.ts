// Shared durable-outbox flush (extracted from app/intake.tsx so the dashboard
// "Replay Outbox" button and the flush-on-boot scheduler run the exact same
// replay logic). The replay algorithm below is byte-identical to the previous
// inline implementation; only the reactive plumbing (queued/failed counters)
// is expressed through the returned FlushResult + onCounts callback.
//
// Flush any writes queued while offline, oldest first, stopping at the first
// transport failure. Each item carries its own client_request_id, so a server
// duplicate-ack still counts as success and retries cannot create duplicates
// (PRD SCR-006; P0 offline registration reconciliation).
// Item kinds:
//  - 'worker_register': payload = { worker: <WorkerCreate body with client_request_id>,
//        questionnaire: { data, client_request_id } }; the profile is created first,
//        then the questionnaire submitted against the (server-side) new profile.
//  - 'symptom_report': payload = { data, client_request_id (symptom purpose) }.
//  - 'questionnaire_submit': payload = { data, client_request_id }.
import { api } from './api'
import {
  readOutbox,
  setOutboxStatus,
  removeOutbox,
  outboxCount,
  clearPendingRequestId,
  deleteDraft,
  isAuthError,
} from './cache'
import { useAppStore } from './store'

export type FlushResult = {
  /** Items attempted this run (excluding previously-failed rows). */
  attempted: number
  /** Items removed from the queue after a server 2xx. */
  succeeded: number
  /** Items moved to 'failed' (permanent rejection) during this run. */
  failed: number
  /** True when replay stopped on an authentication error. */
  authBlocked: boolean
}

const EMPTY: FlushResult = { attempted: 0, succeeded: 0, failed: 0, authBlocked: false }

// Module-level single-flight guard: flush-on-boot, intake's connectivity
// effect and the dashboard replay button can all fire near-simultaneously;
// concurrent runs are impossible.
let flushing = false

export function isFlushInProgress(): boolean {
  return flushing
}

async function runFlush(
  ownerId: string,
  token: string,
  onCounts?: (queued: number, failed: number) => void
): Promise<FlushResult> {
  const result: FlushResult = { attempted: 0, succeeded: 0, failed: 0, authBlocked: false }
  for (const item of readOutbox(ownerId).filter((item) => item.status !== 'failed')) {
    result.attempted++
    setOutboxStatus(item.id, 'syncing', null)
    try {
      if (item.kind === 'worker_register') {
        const { worker, questionnaire } = item.payload
        const created = await api<any>('/workers', token, {
          method: 'POST',
          body: JSON.stringify(worker),
        })
        if (created?.id) {
          const current = useAppStore.getState().session
          if (current) {
            useAppStore.setState({
              session: { ...(current as any), user: { ...(current.user as any), patient_id: created.id } },
            })
          }
        }
        await api('/questionnaires/submit', token, {
          method: 'POST',
          body: JSON.stringify(questionnaire),
        })
      } else if (item.kind === 'symptom_report') {
        await api('/symptom-reports', token, {
          method: 'POST',
          body: JSON.stringify(item.payload),
        })
      } else {
        await api('/questionnaires/submit', token, {
          method: 'POST',
          body: JSON.stringify(item.payload),
        })
      }
      removeOutbox(item.id)
      // Authoritative server ack: retire the pending idempotency key that
      // belongs to this item if it still matches (never touches another
      // owner's key or a minted-for-newer-attempt key).
      const itemCrid = item.kind === 'worker_register'
        ? item.payload?.questionnaire?.client_request_id
        : item.payload?.client_request_id
      if (itemCrid) clearPendingRequestId(ownerId, itemCrid, item.kind === 'symptom_report' ? 'symptom_report' : 'questionnaire')
      deleteDraft(ownerId) // server accepted the full item; local draft is now redundant
      result.succeeded++
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (isAuthError(message)) {
        // Expired/revoked session: keep every queued record, surface the reason.
        setOutboxStatus(item.id, 'failed', 'Session expired. Sign in again to send queued records.')
        result.failed++
        result.authBlocked = true
        break
      }
      if (/\(4(0[03-9]|22)\)|Invalid|required|Validation|validation|Duplicate|already exists|already uses/.test(message)) {
        // Permanent rejection (validation/404/409): keep the draft locally so the
        // user can review and fix it, but stop treating the queue item as retryable.
        setOutboxStatus(item.id, 'failed', message)
        result.failed++
        continue
      }
      // Transport/offline problem: return to the durably queued state and retry later.
      setOutboxStatus(item.id, 'queued', message || 'Network unavailable', 1)
      break
    }
  }
  onCounts?.(outboxCount(ownerId), outboxCount(ownerId, 'failed'))
  return result
}

/**
 * Replay this owner's non-failed outbox items in order. No-op when the app is
 * offline, the owner is in demo mode, or a replay is already running.
 */
export async function flushOutbox(
  ownerId: string,
  token?: string,
  opts: { demo?: boolean; onCounts?: (queued: number, failed: number) => void } = {}
): Promise<FlushResult> {
  if (flushing) return EMPTY
  if (!token || opts.demo || !useAppStore.getState().online) return EMPTY
  flushing = true
  try {
    return await runFlush(ownerId, token, opts.onCounts)
  } finally {
    flushing = false
  }
}
