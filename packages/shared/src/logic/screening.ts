import { REQUIRED_FIELD_IDS } from '../questionnaire';
import type { ScreeningAnswers } from '../schemas/screening';

export interface ScreeningCompleteness {
  complete: boolean;
  missingFieldIds: string[];
  consentMissing: boolean;
}

function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * A screening may be marked COMPLETE only when every required field is
 * answered AND consent has been given (worker_architecture.md §3.5).
 * Pure + shared so the API and mobile app apply the identical rule.
 */
export function evaluateScreeningCompleteness(
  answers: ScreeningAnswers,
  consentGiven: boolean,
  requiredFieldIds: string[] = REQUIRED_FIELD_IDS,
): ScreeningCompleteness {
  const missingFieldIds = requiredFieldIds.filter((id) => !isAnswered(answers[id]));
  const consentMissing = !consentGiven;
  return {
    complete: missingFieldIds.length === 0 && !consentMissing,
    missingFieldIds,
    consentMissing,
  };
}
