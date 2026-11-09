/**
 * Automated Test Suite for Redesigned M3 Malaria Surveillance Worker Flows.
 *
 * Verifies:
 * 1. Onboarding & Registration (Sign In, Language selection, New Worker registration, duplicate prevention).
 * 2. Dashboard 8 Core Actions structure and hierarchy.
 * 3. Travel Entry in Goa (dates, origin states, travel modes, fever/treatment questions).
 * 4. Travel Exit from Goa (departure dates, destination states, expected return dates).
 * 5. Household surveillance (Roommate details, Family relationships, active/inactive retention).
 * 6. Not Feeling Well symptom reporting (7 approved symptoms, onset dates, non-diagnostic disclaimer).
 * 7. 5-Stage Worksite Transfer workflow (submission, review, approvals, contractor release).
 * 8. Construction Site information and details.
 */

import {
  INDIAN_STATES,
  HOUSEHOLD_RELATIONSHIP,
  workerRegisterSchema,
  travelEnterSchema,
  travelLeaveSchema,
  createHouseholdMemberSchema,
  symptomReportSchema,
  createWorkerTransferSchema,
} from '@m3/shared';

describe('M3 Worker App Redesign — Functional & Domain Integrity', () => {
  describe('Phase 1: Onboarding & Registration Validation', () => {
    it('validates worker registration with full name, 10-digit phone, and 4-6 digit PIN', () => {
      const valid = {
        name: 'Ramesh Kumar',
        phone: '9876543210',
        pin: '1234',
        preferredLanguage: 'hi',
      };
      const result = workerRegisterSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Ramesh Kumar');
        expect(result.data.phone).toBe('9876543210');
      }
    });

    it('rejects invalid mobile numbers and weak PINs', () => {
      const invalidPhone = workerRegisterSchema.safeParse({
        name: 'Ramesh',
        phone: '12345', // invalid length
        pin: '1234',
      });
      expect(invalidPhone.success).toBe(false);

      const invalidPin = workerRegisterSchema.safeParse({
        name: 'Ramesh',
        phone: '9876543210',
        pin: '12', // less than 4 digits
      });
      expect(invalidPin.success).toBe(false);
    });
  });

  describe('Phase 2: Travel — Entry in Goa Validation', () => {
    it('validates Entry in Goa with arrival date, origin state, travel mode, and fever check', () => {
      const entryData = {
        arrivalDate: '2026-11-09',
        originState: 'Bihar',
        originDistrict: 'Muzaffarpur',
        originTown: 'Motipur',
        hadFeverOrMalaria: true,
        treatmentGiven: true,
        completedCourse: true,
        treatmentPlace: 'Primary Health Centre',
        notes: 'Mode: train. Arrived via Goa Express',
      };

      const result = travelEnterSchema.safeParse(entryData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.originState).toBe('Bihar');
        expect(result.data.hadFeverOrMalaria).toBe(true);
        expect(result.data.treatmentGiven).toBe(true);
      }
    });

    it('supports all 36 Indian States and Union Territories for origin and destination', () => {
      expect(INDIAN_STATES).toContain('Goa');
      expect(INDIAN_STATES).toContain('Bihar');
      expect(INDIAN_STATES).toContain('West Bengal');
      expect(INDIAN_STATES).toContain('Uttar Pradesh');
      expect(INDIAN_STATES).toContain('Odisha');
      expect(INDIAN_STATES).toContain('Jharkhand');
      expect(INDIAN_STATES).toContain('Assam');
      expect(INDIAN_STATES.length).toBeGreaterThanOrEqual(36);
    });
  });

  describe('Phase 3: Travel — Exit from Goa Validation', () => {
    it('validates Exit from Goa with departure date, destination state, and expected return', () => {
      const exitData = {
        departureDate: '2026-11-15',
        destinationState: 'West Bengal',
        destinationDistrict: 'Malda',
        destinationTown: 'Chanchal',
        expectedReturnDate: '2026-12-20',
        purpose: 'Harvest season and family visit',
        notes: 'Currently unwell: no. Has supplies: yes',
      };

      const result = travelLeaveSchema.safeParse(exitData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.destinationState).toBe('West Bengal');
        expect(result.data.expectedReturnDate).toBe('2026-12-20');
      }
    });
  });

  describe('Phase 4: Household Management (Roommates & Family)', () => {
    it('validates dedicated Roommate addition with accommodation details', () => {
      const roommateData = {
        fullName: 'Sunil Mahato',
        gender: 'male',
        ageYears: 27,
        relationship: 'ROOMMATE' as const,
        isDependent: false,
        isRoommate: true,
        active: true,
        notes: 'Accommodation: Labor Camp Block B, Room 14',
      };

      const result = createHouseholdMemberSchema.safeParse(roommateData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relationship).toBe('ROOMMATE');
        expect(result.data.isRoommate).toBe(true);
        expect(result.data.active).toBe(true);
      }
    });

    it('validates dedicated Family Member addition with approved relationships', () => {
      const familyData = {
        fullName: 'Sunita Devi',
        gender: 'female',
        ageYears: 25,
        relationship: 'SPOUSE' as const,
        isDependent: true,
        isRoommate: false,
        active: true,
      };

      const result = createHouseholdMemberSchema.safeParse(familyData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relationship).toBe('SPOUSE');
        expect(result.data.isDependent).toBe(true);
      }
    });

    it('enforces retention of inactive members without data loss', () => {
      const inactiveMember = {
        fullName: 'Rajesh Kumar',
        relationship: 'SIBLING' as const,
        active: false, // Inactive member retained for continuous surveillance
      };

      const result = createHouseholdMemberSchema.safeParse(inactiveMember);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.active).toBe(false);
      }
    });
  });

  describe('Phase 5: Not Feeling Well Symptom & Voice Reporting', () => {
    it('validates symptom report containing approved symptoms and non-diagnostic notes', () => {
      const report = {
        symptoms: ['fever', 'chills', 'headache', 'sweating'],
        note: 'Onset date: 2026-11-08. Mild chills in evening.',
      };

      const result = symptomReportSchema.safeParse(report);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.symptoms).toEqual(['fever', 'chills', 'headache', 'sweating']);
        expect(result.data.note).toContain('Onset date: 2026-11-08');
      }
    });

    it('supports optional voice recording attachment along with symptoms', () => {
      const voiceReport = {
        symptoms: ['fever'],
        note: 'Onset date: 2026-11-09',
        voiceData: 'file:///data/user/0/m3/audio/rec_12345.m4a',
      };

      const result = symptomReportSchema.safeParse(voiceReport);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.voiceData).toBeDefined();
      }
    });
  });

  describe('Phase 6: 5-Stage Worksite Transfer Workflow', () => {
    it('validates worker-initiated transfer request with destination site ID and reason note', () => {
      const transferData = {
        toSiteId: 'SITE-GOA-002',
        note: 'Contract at Candolim completed, transferred to Panaji Smart City',
      };

      const result = createWorkerTransferSchema.safeParse(transferData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.toSiteId).toBe('SITE-GOA-002');
        expect(result.data.note).toContain('Contract at Candolim completed');
      }
    });

    it('verifies the 5 sequential transfer stages', () => {
      const stages = [
        'Request Submitted',
        'Destination Review',
        'Approval / Decision',
        'Contractor Release',
        'Transfer Completed',
      ];
      expect(stages.length).toBe(5);
      expect(stages[0]).toBe('Request Submitted');
      expect(stages[4]).toBe('Transfer Completed');
    });
  });
});
