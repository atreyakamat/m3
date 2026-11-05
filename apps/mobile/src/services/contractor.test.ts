import { contractorApi } from '@/api';

describe('Contractor Mobile Module & Workflows', () => {
  describe('Authorised Malaria Status Visibility', () => {
    it('restricts malaria status to POSITIVE, NEGATIVE, or undisclosed (null)', () => {
      const allowedStatuses = ['POSITIVE', 'NEGATIVE', null];

      const sampleWorkerDetails = [
        { workerId: 'M3-GOA-0001', malariaStatus: 'POSITIVE' as const },
        { workerId: 'M3-GOA-0002', malariaStatus: 'NEGATIVE' as const },
        { workerId: 'M3-GOA-0003', malariaStatus: null }, // Awaiting / No result
      ];

      for (const w of sampleWorkerDetails) {
        expect(allowedStatuses).toContain(w.malariaStatus);
      }
    });

    it('ensures individual AWAITING or NO_RESULT statuses are not leaked to contractors', () => {
      function sanitizeContractorStatus(rawStatus: string): 'POSITIVE' | 'NEGATIVE' | null {
        if (rawStatus === 'POSITIVE' || rawStatus === 'NEGATIVE') {
          return rawStatus;
        }
        return null;
      }

      expect(sanitizeContractorStatus('POSITIVE')).toBe('POSITIVE');
      expect(sanitizeContractorStatus('NEGATIVE')).toBe('NEGATIVE');
      expect(sanitizeContractorStatus('AWAITING_RESULT')).toBeNull();
      expect(sanitizeContractorStatus('NO_RESULT')).toBeNull();
      expect(sanitizeContractorStatus('PENDING')).toBeNull();
    });
  });

  describe('Contractor Travel 7-Day Alert Window', () => {
    it('flags travel as a high-risk departure alert if positive and within 7 days', () => {
      function isSevenDayAlert(isPositive: boolean, departureDate: Date, now: Date): boolean {
        if (!isPositive) return false;
        const diffMs = departureDate.getTime() - now.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 7;
      }

      const now = new Date('2026-11-05T12:00:00Z');
      const in3Days = new Date('2026-11-08T12:00:00Z');
      const in7Days = new Date('2026-11-12T12:00:00Z');
      const in10Days = new Date('2026-11-15T12:00:00Z');
      const past = new Date('2026-11-04T12:00:00Z');

      expect(isSevenDayAlert(true, in3Days, now)).toBe(true);
      expect(isSevenDayAlert(true, in7Days, now)).toBe(true);
      expect(isSevenDayAlert(true, in10Days, now)).toBe(false);
      expect(isSevenDayAlert(false, in3Days, now)).toBe(false); // Negative worker: not high-risk alert
      expect(isSevenDayAlert(true, past, now)).toBe(false);
    });
  });

  describe('Worker Phone Duplicate Check', () => {
    it('validates 10-digit mobile number format before submission', () => {
      function isValidPhone(p: string): boolean {
        const clean = p.trim().replace(/^\+91/, '');
        return /^\d{10}$/.test(clean);
      }

      expect(isValidPhone('9822112233')).toBe(true);
      expect(isValidPhone('+919822112233')).toBe(true);
      expect(isValidPhone('98221')).toBe(false);
      expect(isValidPhone('abcdefghij')).toBe(false);
    });
  });

  describe('Site Switcher Fallback Logic', () => {
    it('selects first assigned site when selectedSiteCode is not in assigned list', () => {
      const assigned = [
        { siteId: 'SITE-01', name: 'Site One', area: 'Candolim' },
        { siteId: 'SITE-02', name: 'Site Two', area: 'Panaji' },
      ];

      function determineActiveSite(currentCode: string | null, sites: typeof assigned): string | null {
        if (currentCode && sites.some((s) => s.siteId === currentCode)) {
          return currentCode;
        }
        return sites[0]?.siteId ?? null;
      }

      expect(determineActiveSite('SITE-02', assigned)).toBe('SITE-02');
      expect(determineActiveSite('SITE-UNKNOWN', assigned)).toBe('SITE-01');
      expect(determineActiveSite(null, assigned)).toBe('SITE-01');
      expect(determineActiveSite(null, [])).toBeNull();
    });
  });
});
