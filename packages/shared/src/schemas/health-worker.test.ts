import { describe, it, expect } from 'vitest';
import {
  selectActiveFacilitySchema,
  healthWorkerSearchQuerySchema,
  suspectedCaseInputSchema,
  testRequestInputSchema,
  healthWorkerFollowUpInputSchema,
  healthWorkerScreeningInputSchema,
  healthWorkerHouseholdScreeningInputSchema,
} from './health-worker';

describe('Health Worker Shared Schemas', () => {
  describe('selectActiveFacilitySchema', () => {
    it('validates a valid facility ID', () => {
      const valid = { facilityId: '11111111-1111-4111-8111-111111111111' };
      const parsed = selectActiveFacilitySchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('rejects an invalid facility ID', () => {
      const invalid = { facilityId: 'not-a-uuid' };
      const parsed = selectActiveFacilitySchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe('healthWorkerSearchQuerySchema', () => {
    it('accepts search with query string and optional facilityId', () => {
      const valid = { q: 'Ramesh', facilityId: '11111111-1111-4111-8111-111111111111' };
      const parsed = healthWorkerSearchQuerySchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('rejects empty query string', () => {
      const invalid = { q: '   ' };
      const parsed = healthWorkerSearchQuerySchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe('suspectedCaseInputSchema', () => {
    it('validates suspected malaria case input', () => {
      const valid = {
        workerId: '22222222-2222-4222-8222-222222222222',
        facilityId: '11111111-1111-4111-8111-111111111111',
        onsetDate: '2026-11-01',
        symptoms: ['fever', 'chills', 'headache'],
        clinicalObservations: 'High fever 102F noted on examination.',
      };
      const parsed = suspectedCaseInputSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('rejects missing workerId or facilityId', () => {
      const invalid = { symptoms: ['fever'] };
      const parsed = suspectedCaseInputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe('testRequestInputSchema', () => {
    it('accepts RDT test request', () => {
      const valid = {
        episodeId: '33333333-3333-4333-8333-333333333333',
        workerId: '22222222-2222-4222-8222-222222222222',
        facilityId: '11111111-1111-4111-8111-111111111111',
        testType: 'RDT',
        sampleDetails: 'Capillary blood via finger prick',
      };
      const parsed = testRequestInputSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('accepts Microscopy test request with lab referral', () => {
      const valid = {
        episodeId: '33333333-3333-4333-8333-333333333333',
        workerId: '22222222-2222-4222-8222-222222222222',
        facilityId: '11111111-1111-4111-8111-111111111111',
        testType: 'MICROSCOPY',
        labReferralRequired: true,
        referralFacilityId: '44444444-4444-4444-8444-444444444444',
      };
      const parsed = testRequestInputSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid test type', () => {
      const invalid = {
        episodeId: '33333333-3333-4333-8333-333333333333',
        workerId: '22222222-2222-4222-8222-222222222222',
        facilityId: '11111111-1111-4111-8111-111111111111',
        testType: 'PCR', // Not supported in routine field screening
      };
      const parsed = testRequestInputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe('healthWorkerFollowUpInputSchema', () => {
    it('validates follow-up recording with referral attendance', () => {
      const valid = {
        workerId: '22222222-2222-4222-8222-222222222222',
        episodeId: '33333333-3333-4333-8333-333333333333',
        question: 'Follow-up visit day 3',
        response: 'Fever subsided, taking prescribed medications',
        attendedReferral: true,
        note: 'Worker completed initial 3-day course.',
      };
      const parsed = healthWorkerFollowUpInputSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('requires a response string', () => {
      const invalid = {
        workerId: '22222222-2222-4222-8222-222222222222',
        response: '',
      };
      const parsed = healthWorkerFollowUpInputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe('healthWorkerScreeningInputSchema', () => {
    it('validates health worker screening submission', () => {
      const valid = {
        workerId: '22222222-2222-4222-8222-222222222222',
        facilityId: '11111111-1111-4111-8111-111111111111',
        answers: { age: '28', fever_past_year: 'yes' },
        clinicalObservations: 'No active acute distress.',
      };
      const parsed = healthWorkerScreeningInputSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });
  });

  describe('healthWorkerHouseholdScreeningInputSchema', () => {
    it('validates household member assessment input', () => {
      const valid = {
        memberId: '55555555-5555-4555-8555-555555555555',
        facilityId: '11111111-1111-4111-8111-111111111111',
        symptoms: ['chills'],
        examinationFindings: 'Mild pallor noted',
        referralInfo: 'Referred to PHC for full clinical evaluation',
      };
      const parsed = healthWorkerHouseholdScreeningInputSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });
  });
});
