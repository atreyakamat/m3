/**
 * Diagnostic sample validation — extracted from app/diagnostic.tsx so the
 * offline demo mode and automated tests use the EXACT same rejection rules as
 * the live submission path (server enforces the same rules again; client-side
 * validations are convenience, not a security boundary).
 *
 * Pure functions only: no React, no RN, no network.
 */
export type DiagnosticSampleValues = {
  method: 'rdt' | 'microscopy' | 'smp' | 'other'
  result_status: 'pending' | 'positive' | 'negative' | 'indeterminate' | 'cancelled'
  species?: 'pf' | 'pv' | 'mixed' | 'other' | 'undetermined'
  species_other_note?: string
  smear_type?: 'thick' | 'thin' | 'both'
  other_method_note?: string
}

/**
 * Return the FIRST blocking validation error (same order and same messages
 * the screen used inline before), or null when the sample would pass.
 */
export function computeDiagnosticSampleErrors(values: DiagnosticSampleValues): {
  field: 'other_method_note' | 'species' | 'species_other_note' | 'smear_type'
  message: string
} | null {
  if (values.method === 'other' && !(values.other_method_note || '').trim()) {
    return { field: 'other_method_note', message: 'Describe the Other diagnostic test performed.' }
  }
  if (values.result_status === 'positive' && !values.species) {
    return { field: 'species', message: 'Select the identified species for a positive result.' }
  }
  if (values.species === 'other' && !(values.species_other_note || '').trim()) {
    return { field: 'species_other_note', message: 'Describe the other species identified.' }
  }
  if (['microscopy', 'smp'].includes(values.method) && !values.smear_type) {
    return { field: 'smear_type', message: 'Select the type of smear read (Thick / Thin / Both).' }
  }
  return null
}

/**
 * Slide follow-up validation (Day-3/7/14/28 protocol form): not-received
 * requires a reason; "other" reason requires detail; received+positive
 * requires a positive day.
 */
export function computeSlideFollowupErrors(slide: {
  received: 'yes' | 'no'
  not_received_reason?: 'patient_unavailable' | 'left_goa_migrated' | 'refused' | 'slide_broken_spoiled' | 'not_collected_by_worker' | 'other'
  other_reason?: string
}): { field: string; message: string } | null {
  if (slide.received === 'no') {
    if (!slide.not_received_reason) {
      return { field: 'not_received_reason', message: 'Select why the slide was not received.' }
    }
    if (slide.not_received_reason === 'other' && !(slide.other_reason || '').trim()) {
      return { field: 'other_reason', message: 'Please describe the other reason why the slide was not received.' }
    }
  }
  return null
}
