import { outboxRepo } from '@/db/outbox';
import { recordsApi, screeningApi, travelApi, workerApi, healthWorkerApi, isNetworkError } from '@/api';
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
      } else if (item.entityType === 'household_member') {
        const payload = JSON.parse(item.payload);
        await workerApi.addHousehold(token, payload);
        outboxRepo.markSynced(item.id);
        flushed++;
      } else if (item.entityType === 'profile_correction') {
        const payload = JSON.parse(item.payload);
        await workerApi.requestCorrection(token, payload);
        outboxRepo.markSynced(item.id);
        flushed++;
      } else if (item.entityType === 'travel_leaving') {
        const payload = JSON.parse(item.payload);
        await travelApi.leave(token, payload);
        outboxRepo.markSynced(item.id);
        flushed++;
      } else if (item.entityType === 'travel_entering') {
        const payload = JSON.parse(item.payload);
        await travelApi.enter(token, payload);
        outboxRepo.markSynced(item.id);
        flushed++;
      } else if (item.entityType === 'consent_install') {
        const payload = JSON.parse(item.payload);
        await workerApi.consentInstall(token, payload);
        outboxRepo.markSynced(item.id);
        flushed++;
      } else if (item.entityType === 'consent_submission') {
        const payload = JSON.parse(item.payload);
        await workerApi.consentSubmission(token, payload);
        outboxRepo.markSynced(item.id);
        flushed++;
      } else if (item.entityType === 'hw_screening') {
        const payload = JSON.parse(item.payload);
        await healthWorkerApi.recordScreening(token, payload);
        outboxRepo.markSynced(item.id);
        flushed++;
      } else if (item.entityType === 'hw_suspected_case') {
        const payload = JSON.parse(item.payload);
        await healthWorkerApi.recordSuspectedCase(token, payload);
        outboxRepo.markSynced(item.id);
        flushed++;
      } else if (item.entityType === 'hw_test_request') {
        const payload = JSON.parse(item.payload);
        await healthWorkerApi.recordTestRequest(token, payload);
        outboxRepo.markSynced(item.id);
        flushed++;
      } else if (item.entityType === 'hw_follow_up') {
        const payload = JSON.parse(item.payload);
        await healthWorkerApi.recordFollowUp(token, payload);
        outboxRepo.markSynced(item.id);
        flushed++;
      } else if (item.entityType === 'hw_household_assessment') {
        const payload = JSON.parse(item.payload);
        await healthWorkerApi.recordHouseholdScreening(token, payload);
        outboxRepo.markSynced(item.id);
        flushed++;
      } else if (item.entityType === 'hw_arrival_screening') {
        const payload = JSON.parse(item.payload);
        await healthWorkerApi.arrivalScreening(token, payload.travelId, payload);
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
