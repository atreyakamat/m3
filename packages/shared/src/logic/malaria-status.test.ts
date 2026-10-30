import { describe, expect, it } from 'vitest';
import { deriveMalariaStatus } from './malaria-status';

describe('deriveMalariaStatus', () => {
  it('returns NO_RESULT when nothing on record', () => {
    expect(deriveMalariaStatus([])).toBe('NO_RESULT');
  });

  it('never infers NEGATIVE from absence of symptoms — stays NO_RESULT', () => {
    // No diagnostic records at all, even though worker reports feeling fine.
    expect(deriveMalariaStatus([], false)).toBe('NO_RESULT');
  });

  it('returns AWAITING when a sample is pending and no decisive result', () => {
    expect(deriveMalariaStatus([{ result: 'INCONCLUSIVE', testDate: '2026-10-01' }], true)).toBe('AWAITING');
  });

  it('uses the latest decisive result', () => {
    const results = [
      { result: 'NEGATIVE' as const, testDate: '2026-09-01' },
      { result: 'POSITIVE' as const, testDate: '2026-10-01' },
    ];
    expect(deriveMalariaStatus(results)).toBe('POSITIVE');
  });

  it('a later negative supersedes an earlier positive', () => {
    const results = [
      { result: 'POSITIVE' as const, testDate: '2026-09-01' },
      { result: 'NEGATIVE' as const, testDate: '2026-10-05' },
    ];
    expect(deriveMalariaStatus(results)).toBe('NEGATIVE');
  });
});
