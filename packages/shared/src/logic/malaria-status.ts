import type { DiagnosticResultValue, MalariaStatus } from '../enums';

export interface DiagnosticLike {
  result: DiagnosticResultValue;
  testDate: string; // ISO
}

/**
 * Derive displayed malaria status ONLY from authorized diagnostic records.
 * Symptom absence is never treated as negative (worker_architecture.md §3.8):
 *  - latest authorized result POSITIVE  -> POSITIVE
 *  - latest authorized result NEGATIVE  -> NEGATIVE
 *  - a sample/episode awaiting a result -> AWAITING
 *  - nothing on record                  -> NO_RESULT
 */
export function deriveMalariaStatus(
  results: DiagnosticLike[],
  hasPendingSample = false,
): MalariaStatus {
  const decisive = results
    .filter((r) => r.result === 'POSITIVE' || r.result === 'NEGATIVE')
    .sort((a, b) => Date.parse(b.testDate) - Date.parse(a.testDate));

  if (decisive.length > 0) {
    return decisive[0]!.result === 'POSITIVE' ? 'POSITIVE' : 'NEGATIVE';
  }
  if (hasPendingSample) return 'AWAITING';
  return 'NO_RESULT';
}
