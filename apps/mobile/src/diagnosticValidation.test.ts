// Diagnostic input rejection rules (pathologist sample + slide follow-up).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const { computeDiagnosticSampleErrors, computeSlideFollowupErrors }: any = await import(
  pathToFileURL(here + 'diagnosticValidation.ts').href
)

const valid: any = {
  method: 'microscopy',
  result_status: 'negative',
  smear_type: 'both',
}

test('a valid microscopy sample passes', () => {
  assert.equal(computeDiagnosticSampleErrors(valid), null)
})

test('positive results require a species (source questionnaire rule)', () => {
  const v = { ...valid, result_status: 'positive' }
  const err = computeDiagnosticSampleErrors(v)
  assert.equal(err?.field, 'species')
  assert.match(err!.message, /species/i)
  v.species = 'pf'
  assert.equal(computeDiagnosticSampleErrors(v), null)
})

test('species "other" requires a descriptive note', () => {
  const v = { ...valid, result_status: 'positive', species: 'other' }
  const err = computeDiagnosticSampleErrors(v)
  assert.equal(err?.field, 'species_other_note')
  v.species_other_note = 'P. knowlesi (synthetic example)'
  assert.equal(computeDiagnosticSampleErrors(v), null)
})

test('microscopy/smp require a smear type; RDT does not', () => {
  const v = { method: 'microscopy', result_status: 'pending' }
  assert.equal(computeDiagnosticSampleErrors(v)?.field, 'smear_type')
  assert.equal(computeDiagnosticSampleErrors({ method: 'smp', result_status: 'pending' })?.field, 'smear_type')
  assert.equal(
    computeDiagnosticSampleErrors({ method: 'rdt', result_status: 'pending' }),
    null,
    'RDT does not require a smear type'
  )
  v.smear_type = 'thick'
  assert.equal(computeDiagnosticSampleErrors(v), null)
})

test('method "other" requires a note', () => {
  const v = { method: 'other', result_status: 'negative' }
  assert.equal(computeDiagnosticSampleErrors(v)?.field, 'other_method_note')
  v.other_method_note = 'Synthetic PCR-like test'
  assert.equal(computeDiagnosticSampleErrors(v), null)
})

test('slide follow-up: not-received requires a reason; other-reason requires details', () => {
  assert.equal(computeSlideFollowupErrors({ received: 'yes' }), null)
  assert.equal(computeSlideFollowupErrors({ received: 'no', not_received_reason: 'refused' }), null)
  const err = computeSlideFollowupErrors({ received: 'no', not_received_reason: 'other' })
  assert.equal(err?.field, 'other_reason')
  assert.equal(computeSlideFollowupErrors({ received: 'no', not_received_reason: 'other', other_reason: 'Synthetic reason' }), null)
})
