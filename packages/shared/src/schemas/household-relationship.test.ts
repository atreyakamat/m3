import { describe, expect, it } from 'vitest';
import { HOUSEHOLD_RELATIONSHIP } from '../enums';
import { createHouseholdMemberSchema } from './household';

describe('Household Relationships & Demographics Schema (TDD)', () => {
  it('includes OTHER_FAMILY in HOUSEHOLD_RELATIONSHIP enum', () => {
    expect(HOUSEHOLD_RELATIONSHIP).toContain('OTHER_FAMILY');
    expect(HOUSEHOLD_RELATIONSHIP).toContain('SPOUSE');
    expect(HOUSEHOLD_RELATIONSHIP).toContain('CHILD');
    expect(HOUSEHOLD_RELATIONSHIP).toContain('PARENT');
    expect(HOUSEHOLD_RELATIONSHIP).toContain('SIBLING');
    expect(HOUSEHOLD_RELATIONSHIP).toContain('ROOMMATE');
    expect(HOUSEHOLD_RELATIONSHIP).toContain('OTHER');
  });

  it('validates a household member with OTHER_FAMILY relationship', () => {
    const member = createHouseholdMemberSchema.parse({
      fullName: 'Uncle Ramesh',
      relationship: 'OTHER_FAMILY',
      isDependent: true,
      isRoommate: false,
    });
    expect(member.relationship).toBe('OTHER_FAMILY');
  });

  it('allows demographic information to remain NULL during quick field registration', () => {
    const member = createHouseholdMemberSchema.parse({
      fullName: null,
      gender: null,
      ageYears: null,
      relationship: 'CHILD',
    });
    expect(member.fullName).toBeNull();
    expect(member.gender).toBeNull();
    expect(member.ageYears).toBeNull();
    expect(member.relationship).toBe('CHILD');
  });
});
