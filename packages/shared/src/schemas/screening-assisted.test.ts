import { describe, expect, it } from 'vitest';
import { completeScreeningSchema, saveScreeningDraftSchema } from './screening';

describe('Assisted Screening Questionnaire Schema (TDD)', () => {
  it('validates unassisted screening draft and completion with defaults', () => {
    const draft = saveScreeningDraftSchema.parse({
      answers: { full_name: 'Worker One' },
      consentGiven: false,
    });
    expect(draft.isAssisted).toBeFalsy();
    expect(draft.assistedByStaffId).toBeUndefined();

    const complete = completeScreeningSchema.parse({
      answers: { full_name: 'Worker One' },
      consentGiven: true,
      isAssisted: false,
    });
    expect(complete.isAssisted).toBe(false);
  });

  it('validates assisted screening with valid staff ID', () => {
    const complete = completeScreeningSchema.parse({
      answers: { full_name: 'Worker Low Literacy' },
      consentGiven: true,
      isAssisted: true,
      assistedByStaffId: 'hw-user-uuid-1234',
    });
    expect(complete.isAssisted).toBe(true);
    expect(complete.assistedByStaffId).toBe('hw-user-uuid-1234');
  });

  it('allows nullable assistedByStaffId when assistance was not provided', () => {
    const complete = completeScreeningSchema.parse({
      answers: { full_name: 'Self Completed Worker' },
      consentGiven: true,
      isAssisted: false,
      assistedByStaffId: null,
    });
    expect(complete.isAssisted).toBe(false);
    expect(complete.assistedByStaffId).toBeNull();
  });
});
