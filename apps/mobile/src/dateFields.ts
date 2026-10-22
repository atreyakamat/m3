/**
 * Pure date helpers for the M3 questionnaire forms.
 *
 * All date values are 'YYYY-MM-DD' strings interpreted with the device's LOCAL
 * calendar (never Date.parse/ISO-UTC parsing, which can shift the displayed
 * date across timezones). Every boundary is computed at runtime.
 */

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/** Date of birth horizon: at most 90 calendar years before today. */
export const DOB_MAX_PAST_YEARS = 90

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Format a local Date as 'YYYY-MM-DD' (no UTC conversion). */
export function formatISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today on the device's local calendar, as 'YYYY-MM-DD'. */
export function todayISO(): string {
  return formatISO(new Date())
}

/**
 * Parse an ISO string to a local Date, returning null for anything that is not
 * a real calendar date (rejects Feb 29 in non-leap years, month 13, etc.).
 */
export function parseISODate(iso: string): Date | null {
  if (typeof iso !== 'string' || !DATE_REGEX.test(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return dt
}

export function isValidISODateStr(iso: string): boolean {
  return parseISODate(iso) !== null
}

/**
 * Shift a local date whole calendar years, clamping Feb 29 to Feb 28 when the
 * target year is not a leap year (month-end safety for 2024-02-29 → 2025-02-28).
 */
export function addCalendarYears(base: Date, years: number): Date {
  const targetYear = base.getFullYear() + years
  // Leap-year check via the real calendar: a year that is not a multiple of 4
  // is never a leap year; one that is, but not /100 or /400, is Julian-simple.
  const isLeapTarget = (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0
  const day =
    base.getMonth() === 1 && base.getDate() === 29 && !isLeapTarget ? 28 : base.getDate()
  return new Date(targetYear, base.getMonth(), day)
}

/** Earliest selectable date of birth: 90 calendar years before today. */
export function dobMinISO(): string {
  return formatISO(addCalendarYears(new Date(), -DOB_MAX_PAST_YEARS))
}

/** Latest selectable date of birth: today (no future dates). */
export function dobMaxISO(): string {
  return todayISO()
}

/**
 * Age in completed years at `ref` (default today). A birthday that has not
 * occurred yet in the reference year does not count.
 */
export function ageInCompletedYears(dobISO: string, ref?: Date): number | null {
  const dob = parseISODate(dobISO)
  if (!dob) return null
  const at = ref ?? new Date()
  let age = at.getFullYear() - dob.getFullYear()
  if (
    at.getMonth() < dob.getMonth() ||
    (at.getMonth() === dob.getMonth() && at.getDate() < dob.getDate())
  ) {
    age -= 1
  }
  return age
}

/**
 * Validate a date of birth for the questionnaire. Returns a human error
 * message, or null when the value is acceptable.
 */
export function validateDobISO(dob: string): string | null {
  if (!dob) return null
  if (!isValidISODateStr(dob)) {
    return 'Date of birth must be a valid date (YYYY-MM-DD; e.g. 1995-05-15)'
  }
  const min = dobMinISO()
  const max = dobMaxISO()
  if (dob > max) {
    return 'Date of birth cannot be in the future'
  }
  if (dob < min) {
    return `Date of birth cannot be more than ${DOB_MAX_PAST_YEARS} years ago (earlier than ${min})`
  }
  return null
}

/**
 * Past-event date field (symptom onset, etc.): must be a valid calendar date
 * and must not lie in the future.
 */
export function validatePastEventDate(iso: string, label = 'Date'): string | null {
  if (!iso) return null
  if (!isValidISODateStr(iso)) {
    return `${label} must be a valid date (YYYY-MM-DD)`
  }
  if (iso > todayISO()) {
    return `${label} cannot be in the future`
  }
  return null
}

/**
 * Planned travel episode dates: departure is planned forward, so it cannot be
 * in the past; return cannot precede departure. Historical trips belong to the
 * migration-history section, not here.
 */
export function validatePlannedTravelDates(
  departureISO: string,
  returnISO: string
): { departure: string | null; return: string | null } {
  const out: { departure: string | null; return: string | null } = {
    departure: null,
    return: null,
  }
  if (departureISO) {
    if (!isValidISODateStr(departureISO)) {
      out.departure = 'Departure date must be a valid date (YYYY-MM-DD)'
    } else if (departureISO < todayISO()) {
      out.departure = 'Planned departure date cannot be in the past'
    }
  }
  if (returnISO && !isValidISODateStr(returnISO)) {
    out.return = 'Return date must be a valid date (YYYY-MM-DD)'
  }
  if (
    isValidISODateStr(departureISO) &&
    isValidISODateStr(returnISO) &&
    returnISO < departureISO
  ) {
    out.return = 'Return date cannot precede departure date'
  }
  return out
}
