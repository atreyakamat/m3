/**
 * Mobile date-utility regression tests (node:test, run with Node's native
 * TypeScript stripping: `npm run test`).
 *
 * Covers the questionnaire date rules that must match the backend:
 * - date-of-birth boundary (exactly 90 calendar years, one day outside)
 * - future-date rejection on past-event fields
 * - planned travel date ordering
 * - leap-year and month-end handling
 * - age in completed years
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatISO,
  parseISODate,
  isValidISODateStr,
  addCalendarYears,
  dobMinISO,
  dobMaxISO,
  todayISO,
  ageInCompletedYears,
  validateDobISO,
  validatePastEventDate,
  validatePlannedTravelDates,
  DOB_MAX_PAST_YEARS,
} from './dateFields.ts'

const iso = (d: Date): string => formatISO(d)
const plusDays = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return iso(d)
}

test('formatISO uses local calendar, not UTC', () => {
  // Constructed local midnight; a UTC shift would change the day for users in
  // timezones east of UTC around midnight.
  const d = new Date(2026, 9, 22, 23, 30)
  assert.equal(formatISO(d), '2026-10-22')
})

test('parseISODate rejects impossible calendar dates', () => {
  assert.ok(parseISODate('2024-02-29')) // real leap day parses
  assert.ok(isValidISODateStr('2024-02-29'))
  assert.ok(!isValidISODateStr('2025-02-29'))
  assert.ok(!isValidISODateStr('2025-13-01'))
  assert.ok(!isValidISODateStr('2025-00-10'))
  assert.ok(!isValidISODateStr('2025-01-32'))
  assert.ok(!isValidISODateStr('20261022'))
  assert.ok(!isValidISODateStr('1999-02-30'))
})

test('addCalendarYears keeps month-end and leap-day semantics', () => {
  assert.equal(iso(addCalendarYears(new Date(2024, 1, 29), 1)), '2025-02-28')
  assert.equal(iso(addCalendarYears(new Date(2024, 1, 29), 4)), '2028-02-29')
  assert.equal(iso(addCalendarYears(new Date(2024, 1, 29), -90)), '1934-02-28')
  assert.equal(iso(addCalendarYears(new Date(2024, 0, 31), 1)), '2025-01-31')
  assert.equal(iso(addCalendarYears(new Date(2023, 2, 31), 1)), '2024-03-31')
})

test('dob boundaries: today and exactly 90 calendar years ago', () => {
  assert.equal(dobMaxISO(), todayISO())
  const min = dobMinISO()
  assert.equal(iso(addCalendarYears(new Date(), -DOB_MAX_PAST_YEARS)), min)
})

test('validateDobISO accepts the exact lower boundary, rejects one day outside', () => {
  const min = dobMinISO()
  assert.equal(validateDobISO(min), null)
  const oneDayEarlier = new Date(min + 'T00:00:00')
  oneDayEarlier.setDate(oneDayEarlier.getDate() - 1)
  const msg = validateDobISO(iso(oneDayEarlier))
  assert.ok(msg && msg.includes('90 years'), msg ?? 'expected 90-year message')
})

test('validateDobISO rejects future dates, including one day past today', () => {
  const msg = validateDobISO(plusDays(1))
  assert.ok(msg && msg.includes('future'), msg ?? 'expected future message')
  assert.equal(validateDobISO(plusDays(0)), null)
})

test('validateDobISO gives clear errors and preserves formatting rules', () => {
  assert.ok(validateDobISO('not-a-date')?.includes('valid date'))
  assert.equal(validateDobISO('1995-05-15'), null)
  assert.equal(validateDobISO('2024-02-29'), null) // leap-day DOB still selectable
})

test('ageInCompletedYears counts completed years only', () => {
  assert.equal(ageInCompletedYears('2000-03-01', new Date(2026, 2, 1)), 26)
  assert.equal(ageInCompletedYears('2000-03-01', new Date(2026, 1, 28)), 25)
  // Leap-day DOB: birthday completes from Feb 28 in non-leap years.
  assert.equal(ageInCompletedYears('2024-02-29', new Date(2025, 1, 27)), 0)
  assert.equal(ageInCompletedYears('2024-02-29', new Date(2025, 2, 1)), 1)
  assert.equal(ageInCompletedYears('1995-05-15', new Date(2026, 9, 22)), 31)
  // DOB equals the reference date: first day of life counts as 0 completed years.
  assert.equal(ageInCompletedYears('2026-10-22', new Date(2026, 9, 22)), 0)
  assert.equal(ageInCompletedYears('1999-02-30'), null) // impossible date
  // At the exact 90-year horizon the calculated age must be DOB_MAX_PAST_YEARS.
  assert.equal(ageInCompletedYears(dobMinISO(), new Date()), DOB_MAX_PAST_YEARS)
})

test('validatePastEventDate rejects future onset but accepts today', () => {
  assert.equal(validatePastEventDate('', 'Onset date'), null) // empty stays for required-check elsewhere
  assert.equal(validatePastEventDate(plusDays(-2), 'Onset date'), null)
  assert.equal(validatePastEventDate(plusDays(0), 'Onset date'), null)
  const msg = validatePastEventDate(plusDays(2), 'Onset date')
  assert.ok(msg && msg.includes('future'), msg ?? 'expected future message')
  assert.ok(validatePastEventDate('2025-02-30', 'Onset date')?.includes('valid date'))
})

test('validatePlannedTravelDates: return before departure is rejected', () => {
  const dep = plusDays(30)
  const ret = plusDays(10)
  const errs = validatePlannedTravelDates(dep, ret)
  assert.match(errs.return ?? '', /Return date cannot precede departure/)
})

test('validatePlannedTravelDates: departure today or future is allowed', () => {
  let errs = validatePlannedTravelDates(plusDays(0), plusDays(5))
  assert.equal(errs.departure, null)
  assert.equal(errs.return, null)
  errs = validatePlannedTravelDates(plusDays(30), plusDays(40))
  assert.equal(errs.departure, null)
  assert.equal(errs.return, null)
})

test('validatePlannedTravelDates: past departure is rejected with clear message', () => {
  const errs = validatePlannedTravelDates(plusDays(-30), plusDays(-20))
  assert.match(errs.departure ?? '', /cannot be in the past/)
})
