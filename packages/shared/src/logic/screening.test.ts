import { describe, expect, it } from 'vitest';
import { evaluateScreeningCompleteness } from './screening';

const required = ['full_name', 'gender', 'mobile_number', 'fever_today'];

describe('evaluateScreeningCompleteness', () => {
  it('is incomplete with no answers', () => {
    const r = evaluateScreeningCompleteness({}, false, required);
    expect(r.complete).toBe(false);
    expect(r.missingFieldIds).toEqual(required);
    expect(r.consentMissing).toBe(true);
  });

  it('is incomplete when consent missing even if all fields present', () => {
    const answers = { full_name: 'Asha', gender: 'female', mobile_number: '9876543210', fever_today: 'no' };
    const r = evaluateScreeningCompleteness(answers, false, required);
    expect(r.missingFieldIds).toEqual([]);
    expect(r.consentMissing).toBe(true);
    expect(r.complete).toBe(false);
  });

  it('treats blank/empty-array answers as missing', () => {
    const answers = { full_name: '   ', gender: '', mobile_number: '9876543210', fever_today: [] };
    const r = evaluateScreeningCompleteness(answers, true, required);
    expect(r.missingFieldIds).toEqual(['full_name', 'gender', 'fever_today']);
  });

  it('is complete when all required answered and consent given', () => {
    const answers = { full_name: 'Asha', gender: 'female', mobile_number: '9876543210', fever_today: 'no' };
    const r = evaluateScreeningCompleteness(answers, true, required);
    expect(r.complete).toBe(true);
  });
});
