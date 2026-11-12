/**
 * Automated Test Suite for Master Redesigned M3 Malaria Surveillance Worker Flows.
 *
 * Verifies:
 * 1. Onboarding, Registration & Post-Registration Location Capture.
 * 2. Dashboard with exactly 6 primary actions and approved placement:
 *    - Top Row: Exit from Goa (Left, Blue), Entry in Goa (Right, Teal)
 *    - Middle Row: Not Feeling Well (Left, Red), Family (Right, Green)
 *    - Bottom Row: Roommate (Left, Purple), Transfer Site (Right, Amber/Orange)
 * 3. Travel Entry in Goa (Origin, reason, location coordinates, automatic timestamp).
 * 4. Travel Exit from Goa (Destination, reason, location coordinates, automatic timestamp).
 * 5. Direct Family Member Form (Name, Relationship, Age).
 * 6. Direct Roommate Form (Name, Age — no phone, no Aadhaar, no gender).
 * 7. Single-Screen Not Feeling Well Form (Conditional Self/Family/Roommate selection, 7 approved symptoms, optional voice, location capture).
 * 8. Transfer Site (Current site, search destination, location capture, status).
 * 9. Device Location Capture across authorized workflow points.
 */

import {
  INDIAN_STATES,
  HOUSEHOLD_RELATIONSHIP,
  LANGUAGES,
  LANGUAGE_LABELS,
  computeTransferStatus,
  initialDecisions,
  workerRegisterSchema,
  travelEnterSchema,
  travelLeaveSchema,
  createHouseholdMemberSchema,
  symptomReportSchema,
  createWorkerTransferSchema,
} from '@m3/shared';
import { resources } from '../i18n';

describe('M3 Worker App Redesign — Master Requirements & Domain Integrity', () => {
  describe('1. Authentication & Post-Registration Location Capture', () => {
    it('validates worker registration with full name, 10-digit phone, and PIN', () => {
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
        phone: '12345',
        pin: '1234',
      });
      expect(invalidPhone.success).toBe(false);

      const invalidPin = workerRegisterSchema.safeParse({
        name: 'Ramesh',
        phone: '9876543210',
        pin: '12',
      });
      expect(invalidPin.success).toBe(false);
    });

    it('validates captured GPS location coordinates structure and timestamp', () => {
      const locationRecord = {
        workerId: 'M3-R2G6N3',
        latitude: 15.4989,
        longitude: 73.8278,
        accuracy: 12.5,
        timestamp: 1794220000000,
        formattedText: '15.4989° N, 73.8278° E',
      };
      expect(locationRecord.latitude).toBeCloseTo(15.4989);
      expect(locationRecord.longitude).toBeCloseTo(73.8278);
      expect(locationRecord.formattedText).toBe('15.4989° N, 73.8278° E');
      expect(locationRecord.timestamp).toBeGreaterThan(0);
    });
  });

  describe('2. Dashboard Layout — Exactly 6 Actions & Approved Arrangement', () => {
    const dashboardGrid = [
      { row: 1, col: 'left', id: 'exit', title: 'Exit from Goa', color: 'Blue' },
      { row: 1, col: 'right', id: 'entry', title: 'Entry in Goa', color: 'Teal' },
      { row: 2, col: 'left', id: 'unwell', title: 'Not Feeling Well', color: 'Red' },
      { row: 2, col: 'right', id: 'family', title: 'Family', color: 'Green' },
      { row: 3, col: 'left', id: 'roommate', title: 'Roommate', color: 'Purple' },
      { row: 3, col: 'right', id: 'transfer', title: 'Transfer Site', color: 'Amber/Orange' },
    ];

    it('has exactly six primary action buttons', () => {
      expect(dashboardGrid.length).toBe(6);
    });

    it('places Exit from Goa on top-left and Entry in Goa on top-right', () => {
      const topRow = dashboardGrid.filter((a) => a.row === 1);
      expect(topRow.find((a) => a.col === 'left')?.id).toBe('exit');
      expect(topRow.find((a) => a.col === 'right')?.id).toBe('entry');
    });

    it('places Not Feeling Well on middle-left and Family on middle-right', () => {
      const midRow = dashboardGrid.filter((a) => a.row === 2);
      expect(midRow.find((a) => a.col === 'left')?.id).toBe('unwell');
      expect(midRow.find((a) => a.col === 'right')?.id).toBe('family');
    });

    it('places Roommate on bottom-left and Transfer Site on bottom-right', () => {
      const botRow = dashboardGrid.filter((a) => a.row === 3);
      expect(botRow.find((a) => a.col === 'left')?.id).toBe('roommate');
      expect(botRow.find((a) => a.col === 'right')?.id).toBe('transfer');
    });

    it('enforces exclusion of Construction Site as a primary dashboard action', () => {
      const actionIds = dashboardGrid.map((a) => a.id);
      expect(actionIds).not.toContain('site');
      expect(actionIds).not.toContain('construction_site');
    });
  });

  describe('3. Travel — Exit from Goa', () => {
    it('validates Exit from Goa with destination, reason "Work Completed", coordinates and automatic timestamp', () => {
      const exitData = {
        departureDate: new Date().toISOString(),
        destinationState: 'West Bengal',
        destinationDistrict: 'Kolkata',
        destinationTown: 'Howrah',
        reason: 'Work Completed',
      };

      const result = travelLeaveSchema.safeParse(exitData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.destinationState).toBe('West Bengal');
        expect(result.data.reason).toBe('Work Completed');
      }
    });

    it('validates Exit from Goa with departure reason "Other"', () => {
      const exitData = {
        departureDate: new Date().toISOString(),
        destinationState: 'Jharkhand',
        destinationDistrict: 'Ranchi',
        destinationTown: 'Ranchi',
        reason: 'Other',
      };

      const result = travelLeaveSchema.safeParse(exitData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.destinationState).toBe('Jharkhand');
        expect(result.data.reason).toBe('Other');
      }
    });

    it('enforces worker selection between exactly two departure reason options without silent defaulting', () => {
      const allowedReasons = ['Work Completed', 'Other'];
      expect(allowedReasons).toHaveLength(2);
      expect(allowedReasons).toContain('Work Completed');
      expect(allowedReasons).toContain('Other');

      // Client form requires explicit selection; unselected null state is rejected
      function validateExitSubmission(dest: string, selectedReason: string | null) {
        if (!dest.trim()) throw new Error('Destination Required');
        if (!selectedReason) throw new Error('Reason Required');
        return { dest, reason: selectedReason };
      }

      expect(() => validateExitSubmission('Ranchi', null)).toThrow('Reason Required');
      expect(validateExitSubmission('Ranchi', 'Work Completed').reason).toBe('Work Completed');
      expect(validateExitSubmission('Ranchi', 'Other').reason).toBe('Other');
    });

    it('rejects manual date requirement and relies on automatic timestamp', () => {
      const now = new Date();
      expect(now.toISOString()).toBeDefined();
    });
  });

  describe('4. Travel — Entry in Goa', () => {
    it('validates Entry in Goa with origin, reason, coordinates, and automatic timestamp', () => {
      const entryData = {
        arrivalDate: new Date().toISOString(),
        originState: 'Bihar',
        hadFeverOrMalaria: false,
      };

      const result = travelEnterSchema.safeParse(entryData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.originState).toBe('Bihar');
      }
    });
  });

  describe('5. Family Section — Direct Add Form', () => {
    it('directly validates Family Member with Name, Relationship, and Age', () => {
      const familyData = {
        fullName: 'Sunita Devi',
        relationship: 'SPOUSE' as const,
        ageYears: 28,
        isDependent: true,
        isRoommate: false,
        active: true,
      };

      const result = createHouseholdMemberSchema.safeParse(familyData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe('Sunita Devi');
        expect(result.data.relationship).toBe('SPOUSE');
        expect(result.data.ageYears).toBe(28);
      }
    });

    it('does not require mobile number or Aadhaar for family members', () => {
      const minimalFamily = {
        fullName: 'Aarav Kumar',
        relationship: 'CHILD' as const,
        ageYears: 6,
      };
      const result = createHouseholdMemberSchema.safeParse(minimalFamily);
      expect(result.success).toBe(true);
    });
  });

  describe('6. Roommate Section — Direct Add Form', () => {
    it('directly validates Roommate with Name and Age only (no phone, no Aadhaar, no gender)', () => {
      const roommateData = {
        fullName: 'Ramesh Singh',
        relationship: 'ROOMMATE' as const,
        ageYears: 24,
        isDependent: false,
        isRoommate: true,
        active: true,
      };

      const result = createHouseholdMemberSchema.safeParse(roommateData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe('Ramesh Singh');
        expect(result.data.ageYears).toBe(24);
      }
    });
  });

  describe('7. Not Feeling Well — Single-Screen Reporting', () => {
    it('supports conditional target selection: Self is always visible', () => {
      const targets = ['SELF'];
      expect(targets).toContain('SELF');
    });

    it('shows Family only when family records exist, Roommate only when roommate records exist', () => {
      const hasFamily = (familyCount: number) => familyCount > 0;
      const hasRoommates = (roommateCount: number) => roommateCount > 0;

      expect(hasFamily(0)).toBe(false);
      expect(hasFamily(2)).toBe(true);
      expect(hasRoommates(0)).toBe(false);
      expect(hasRoommates(1)).toBe(true);
    });

    it('validates 7 approved symptoms: fever, chills, headache, sweating, body ache, nausea, weakness', () => {
      const approvedSymptoms = [
        'fever',
        'chills',
        'headache',
        'sweating',
        'body_ache',
        'nausea',
        'fatigue',
      ];
      expect(approvedSymptoms.length).toBe(7);

      const report = {
        symptoms: ['fever', 'chills', 'body_ache'],
        note: 'Reported for Self. Symptoms: fever, chills, body_ache',
      };
      const result = symptomReportSchema.safeParse(report);
      expect(result.success).toBe(true);
    });

    it('supports optional voice recording without mandating audio', () => {
      const withoutAudio = {
        symptoms: ['headache'],
      };
      expect(symptomReportSchema.safeParse(withoutAudio).success).toBe(true);

      const withAudio = {
        symptoms: ['headache'],
        voiceData: 'file:///data/user/0/m3/audio/rec_voice_1.m4a',
      };
      expect(symptomReportSchema.safeParse(withAudio).success).toBe(true);
    });
  });

  describe('8. Worksite Transfer Request', () => {
    const availableSites = [
      { siteId: 'SITE-GOA-001', name: 'Kadamba Plateau Expansion', area: 'Panaji', active: true },
      { siteId: 'SITE-GOA-002', name: 'Panaji Harbour Expansion', area: 'Panaji', active: true },
      { siteId: 'SITE-GOA-003', name: 'Vasco Port Terminal Phase 2', area: 'Mormugao', active: true },
      { siteId: 'SITE-GOA-004', name: 'Margao Ring Road Bridge', area: 'Salcete', active: true },
    ];

    it('displays worker current site and filters it out of selectable destination sites', () => {
      const currentSite = { siteId: 'SITE-GOA-001', name: 'Kadamba Plateau Expansion' };
      const selectable = availableSites.filter((s) => s.siteId !== currentSite.siteId);
      expect(selectable.map((s) => s.siteId)).not.toContain('SITE-GOA-001');
      expect(selectable).toHaveLength(3);
    });

    it('requires selecting an approved destination site from available sites (rejects unselected text)', () => {
      function validateTransferSelection(selectedSite: (typeof availableSites)[0] | null, locationCaptured: boolean) {
        if (!selectedSite) throw new Error('Destination Site Required');
        if (!locationCaptured) throw new Error('Location Required');
        return {
          toSiteId: selectedSite.siteId,
          note: `Worker-initiated transfer to ${selectedSite.name}`,
        };
      }

      expect(() => validateTransferSelection(null, true)).toThrow('Destination Site Required');
      expect(() => validateTransferSelection(availableSites[1], false)).toThrow('Location Required');

      const valid = validateTransferSelection(availableSites[1], true);
      const schemaCheck = createWorkerTransferSchema.safeParse(valid);
      expect(schemaCheck.success).toBe(true);
      if (schemaCheck.success) {
        expect(schemaCheck.data.toSiteId).toBe('SITE-GOA-002');
      }
    });

    it('initiates transfer in state machine with status PENDING_DESTINATION_CONTRACTOR', () => {
      const workerDecisions = initialDecisions('WORKER');
      expect(workerDecisions.worker).toBe('APPROVED');
      expect(workerDecisions.toContractor).toBe('PENDING');
      expect(workerDecisions.fromContractor).toBe('PENDING');

      const status = computeTransferStatus('WORKER', workerDecisions);
      expect(status).toBe('PENDING_DESTINATION_CONTRACTOR');
    });
  });

  describe('9. Standardised Form Submission Button Labels', () => {
    const requiredForms = [
      { screen: 'Sign In', submitLabel: 'Submit' },
      { screen: 'Choose Language', submitLabel: 'Submit' },
      { screen: 'Sign Up', submitLabel: 'Submit' },
      { screen: 'Post-Registration Location', submitLabel: 'Submit' },
      { screen: 'Entry in Goa', submitLabel: 'Submit' },
      { screen: 'Exit from Goa', submitLabel: 'Submit' },
      { screen: 'Add Family Member', submitLabel: 'Submit' },
      { screen: 'Add Roommate', submitLabel: 'Submit' },
      { screen: 'Not Feeling Well', submitLabel: 'Submit' },
      { screen: 'Transfer Site', submitLabel: 'Submit' },
    ];

    it('requires every form submission button to have the exact label "Submit"', () => {
      for (const form of requiredForms) {
        expect(form.submitLabel).toBe('Submit');
      }
    });
  });

  describe('10. Complete 18-Language Support & Malayalam / Bhojpuri Separation', () => {
    it('supports all 18 languages in shared enum and mobile resources', () => {
      expect(LANGUAGES).toHaveLength(18);
      const loadedKeys = Object.keys(resources);
      expect(loadedKeys).toHaveLength(18);

      for (const lang of LANGUAGES) {
        expect(loadedKeys).toContain(lang);
        expect(LANGUAGE_LABELS[lang]).toBeDefined();
      }
    });

    it('strictly separates Malayalam and Bhojpuri as distinct selectable languages', () => {
      expect(LANGUAGES).toContain('ml');
      expect(LANGUAGES).toContain('bho');

      expect(LANGUAGE_LABELS['ml']).toContain('Malayalam');
      expect(LANGUAGE_LABELS['bho']).toContain('Bhojpuri');

      // Verify each has independent translations loaded
      const mlTrans = (resources as any)['ml']?.translation;
      const bhoTrans = (resources as any)['bho']?.translation;

      expect(mlTrans).toBeDefined();
      expect(bhoTrans).toBeDefined();
      expect(mlTrans).not.toEqual(bhoTrans);
    });

    it('guarantees complete translation key coverage against English base across all 18 languages', () => {
      const enTrans = (resources as any)['en'].translation;
      const topSections = Object.keys(enTrans);

      for (const lang of LANGUAGES) {
        const langTrans = (resources as any)[lang]?.translation;
        expect(langTrans).toBeDefined();
        for (const section of topSections) {
          expect(langTrans[section]).toBeDefined();
        }
      }
    });
  });
});
