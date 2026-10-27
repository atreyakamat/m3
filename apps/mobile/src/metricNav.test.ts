/** Dashboard count-card navigation tests (report §24) — node --test, pure module.
 *  Verifies that each mobile metric card's destination matches the server's
 *  list authorization: tappable only where a role-scoped list endpoint exists. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  destinationHint,
  isWorkerOnlyRole,
  metricDestination,
} from './metricNav.ts'

test('worker-only dashboard: all three metric cards stay inert', () => {
  assert.equal(isWorkerOnlyRole(['worker']), true)
  assert.equal(metricDestination('workers', ['worker']), null)
  assert.equal(metricDestination('pathology', ['worker']), null)
  assert.equal(metricDestination('followups', ['worker']), null)
})

test('tapping-equivalent decisions: Workers card/count/icon share one route per role', () => {
  // One pressable per card — count and icon are children of it, so all three
  // actions resolve to the same metricDestination.
  for (const roles of [
    ['clinician'],
    ['admin'],
    ['contractor'],
    ['health_worker'],
    ['pathologist'],
    ['research_lab'],
  ]) {
    assert.equal(metricDestination('workers', roles), '/workers', roles.join('+'))
  }
})

test('Diagnostics card opens the samples list only for roles GET /samples authorizes', () => {
  assert.equal(metricDestination('pathology', ['pathologist']), '/samples')
  assert.equal(metricDestination('pathology', ['pathology']), '/samples')
  assert.equal(metricDestination('pathology', ['research_lab']), '/samples')
  assert.equal(metricDestination('pathology', ['clinician']), null)
  assert.equal(metricDestination('pathology', ['admin']), null)
  assert.equal(metricDestination('pathology', ['contractor']), null)
  assert.equal(metricDestination('pathology', ['health_worker']), null)
})

test('worker holding an extra pathology role can open diagnostics but stays worker-scoped', () => {
  assert.equal(isWorkerOnlyRole(['worker', 'pathologist']), false)
  assert.equal(metricDestination('pathology', ['worker', 'pathologist']), '/samples')
})

test('Follow-ups card opens the queue for health workers and clinicians only', () => {
  assert.equal(metricDestination('followups', ['health_worker']), '/followup')
  assert.equal(metricDestination('followups', ['clinician']), '/followup')
  assert.equal(metricDestination('followups', ['admin']), null)
  assert.equal(metricDestination('followups', ['pathologist']), null)
  assert.equal(metricDestination('followups', ['contractor']), null)
})

test('clinician multi-role compound session keeps every card consistent', () => {
  const roles = ['clinician', 'pathologist']
  assert.equal(metricDestination('workers', roles), '/workers')
  assert.equal(metricDestination('pathology', roles), '/samples')
  assert.equal(metricDestination('followups', roles), '/followup')
})

test('empty/unknown role arrays are safely inert', () => {
  assert.equal(metricDestination('workers', []), null)
  assert.equal(metricDestination('pathology', []), null)
  assert.equal(metricDestination('followups', []), null)
  assert.equal(metricDestination('workers', undefined as unknown as string[]), null)
})

test('accessibility hints describe destinations, not metrics', () => {
  assert.equal(destinationHint('workers'), 'Opens the worker records list')
  assert.equal(destinationHint('pathology'), 'Opens the diagnostic samples list')
  assert.equal(destinationHint('followups'), 'Opens the follow-up queue')
})
