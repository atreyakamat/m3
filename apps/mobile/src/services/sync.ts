import { outboxRepo } from '@/db/outbox';
import { recordsApi, screeningApi, isNetworkError } from '@/api';
import { screeningLocalRepo } from './screeningLocal';

export function pendingCount(): number {
  return outboxRepo.pendingOrFailed().length;
}

export async function flushOutbox(token: string): Promise<number> {
  const items = outboxRepo.pendingOrFailed();
  let flushed = 0;
  for (const item of items) {
    try {
      if (item.entityType === 'symptom_report') {
        const payload = JSON.parse(item.payload);
        await recordsApi.submitSymptom(token, {
          ...payload,
          idempotencyKey: item.idempotencyKey,
        });
        outboxRepo.markSynced(item.id);
        flushed++;
      } else if (item.entityType === 'travel_record') {
        const payload = JSON.parse(item.payload);
        await recordsApi.submitTravel(token, {
          ...payload,
          idempotencyKey: item.idempotencyKey,
        });
        outboxRepo.markSynced(item.id);
        flushed++;
      } else if (item.entityType === 'screening') {
        const payload = JSON.parse(item.payload);
        try {
          await screeningApi.complete(token, payload.answers);
          outboxRepo.markSynced(item.id);
          screeningLocalRepo.markSynced(item.localId);
          flushed++;
        } catch (err: unknown) {
          if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 409) {
            // Server already completed this screening — mark synced
            outboxRepo.markSynced(item.id);
            screeningLocalRepo.markSynced(item.localId);
            flushed++;
          } else {
            throw err;
          }
        }
      } else if (item.entityType === 'screening_draft') {
        const payload = JSON.parse(item.payload);
        await screeningApi.saveDraft(token, payload.answers, payload.consentGiven);
        outboxRepo.markSynced(item.id);
        flushed++;
      }
    } catch (e) {
      if (isNetworkError(e)) {
        // Network error — leave as pending to retry when connectivity returns
        continue;
      }
      outboxRepo.markFailed(item.id, String(e), item.attempts + 1);
    }
  }
  return flushed;
}
