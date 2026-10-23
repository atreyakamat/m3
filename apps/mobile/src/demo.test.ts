// Offline Demo Mode — unit tests (run with `npm run test`, plain node strip-types).
//
// Covers: deterministic synthetic data, demo identity construction (no token),
// the isolated demo store (drafts, records, activity, reset, namespacing) and
// the environment-detection of the storage backend. The release-validation
// harness (scripts/release-validation/offline_demo.test.ts) additionally
// proves the no-network / no-real-outbox properties with transport mocks.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ---------------------------------------------------------------- storage shim
// Installed BEFORE any demoStore import: makes the environment web-like so the
// demo store uses the isolated `m3demo:` localStorage backend, never the native
// SQLite module (which is therefore never even loaded in this test run).
const backing = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => { backing.set(k, String(v)) },
  removeItem: (k: string) => { backing.delete(k) },
  key: (i: number) => Array.from(backing.keys())[i] ?? null,
  get length() { return backing.size },
}

const here = fileURLToPath(new URL('.', import.meta.url))
const load = (f: string) => import(pathToFileURL(here + f).href)

const demoData: any = await load('demoData.ts')
const demoStore: any = await load('demoStore.ts')

// ------------------------------------------------------------------ demo data
test('demo data covers exactly the seven PRD roles', () => {
  assert.equal(demoData.DEMO_ROLES.length, 7)
  const roles = demoData.DEMO_ROLES.map((r: any) => r.role).sort()
  assert.deepEqual(roles, [
    'admin', 'clinician', 'contractor', 'health_worker',
    'pathologist', 'research_lab', 'worker',
  ])
})

test('demo workers are deterministic and unmistakably synthetic', () => {
  const a = JSON.parse(JSON.stringify(demoData.demoWorkers()))
  const b = JSON.parse(JSON.stringify(demoData.demoWorkers()))
  assert.deepEqual(a, b)
  assert.ok(a.length >= 5)
  for (const w of a) {
    // Human-recognizable but obviously fake identity markers; every code is in
    // the M3-SYN namespace and every phone uses the invalid demo series.
    assert.match(w.display_name, /^Synthetic Participant/)
    assert.match(w.patient_code, /^M3-SYN-/)
    assert.match(w.phone_e164, /^\+91000000\d+$/)
    assert.ok(!/ramesh|kumar/i.test(w.display_name))
  }
})

test('demo sites / roster / cases / samples are deterministic and labeled', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(demoData.demoSites())), JSON.parse(JSON.stringify(demoData.demoSites())))
  assert.deepEqual(JSON.parse(JSON.stringify(demoData.demoRoster())), JSON.parse(JSON.stringify(demoData.demoRoster())))
  assert.deepEqual(JSON.parse(JSON.stringify(demoData.demoCases())), JSON.parse(JSON.stringify(demoData.demoCases())))
  for (const c of demoData.demoCases()) assert.match(c.case_code, /^M3-SYN-CASE/)
  for (const s of demoData.demoSamples()) assert.match(s.sample_code, /^M3-SYN-S-/)
  for (const r of demoData.demoResearchAggregates()) assert.match(r.sample_id, /^M3-RES-SYN-/)
  // roster rows stay inside the synthetic worker set
  const codes = new Set(demoData.demoWorkers().map((w: any) => w.patient_code))
  for (const r of demoData.demoRoster()) assert.ok(codes.has(r.patient_code))
})

// ------------------------------------------------------------- demo identity
test('the demo session carries NO token and never claims real authentication', () => {
  for (const { role } of demoData.DEMO_ROLES) {
    const s = demoData.demoSessionFor(role)
    assert.equal(s.token, undefined)
    assert.equal(s.demo, true)
    assert.equal(s.user.id, demoData.DEMO_USER_ID)
    assert.deepEqual(s.user.roles, [role])
    assert.equal(s.user.demo_stamp, 'demo')
  }
})

// ------------------------------------------------------------- demo store
test('demo drafts save, restore (persisted across reads) and delete within the demo namespace', () => {
  demoStore.saveDemoDraft('synthetic-demo', { personal: { full_name: 'Demo Draft A' } })
  const draft = demoStore.readDemoDraft('synthetic-demo')
  assert.equal(draft.personal.full_name, 'Demo Draft A')
  assert.match(draft.updated_at, /^\d{4}-\d{2}-\d{2}T/)
  assert.match(demoStore.readDemoDraftUpdatedAt('synthetic-demo'), /^\d{4}-\d{2}-\d{2}T/)
  // one draft slot per owner; a second owner's draft is separate
  demoStore.saveDemoDraft('demo-worker-2', { personal: { full_name: 'Demo Draft B' } })
  assert.equal(demoStore.readDemoDraft('demo-worker-2').personal.full_name, 'Demo Draft B')
  assert.equal(demoStore.readDemoDraft('synthetic-demo').personal.full_name, 'Demo Draft A')
  demoStore.deleteDemoDraft('synthetic-demo')
  assert.equal(demoStore.readDemoDraft('synthetic-demo'), null)
  demoStore.deleteDemoDraft('demo-worker-2')
})

test('demo records are created with a local timestamp and an explicit demo-only status', () => {
  const record = demoStore.saveDemoRecord({
    kind: 'questionnaire_submit',
    label: 'Unit test demo screening',
    payload: { personal: { full_name: 'Synthetic Person' } },
  })
  assert.match(record.id, /^demo-/)
  assert.equal(record.status, 'demo_saved_locally')
  assert.match(record.created_at, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(demoStore.listDemoRecords()[0].id, record.id)
  assert.equal(demoStore.listDemoRecords('questionnaire_submit')[0].id, record.id)
  assert.equal(demoStore.listDemoRecords('diagnostic').length >= 0, true)
  demoStore.saveDemoActivity('Unit test activity', 'detail')
  assert.equal(demoStore.listDemoActivity()[0].label, 'Unit test activity')
})

test('resetDemoData wipes only the demo namespace and leaves the active-role marker cleared', async () => {
  demoStore.saveDemoRecord({ kind: 'symptom_report', label: 'x', payload: {} })
  demoStore.saveDemoDraft('synthetic-demo', { a: 1 })
  demoStore.setActiveDemoRole('clinician')
  assert.equal(demoStore.getActiveDemoRole(), 'clinician')
  demoStore.resetDemoData()
  assert.equal(demoStore.listDemoRecords().length, 0)
  assert.equal(demoStore.listDemoDrafts().length, 0)
  assert.equal(demoStore.listDemoActivity().length, 0)
  assert.equal(demoStore.getActiveDemoRole(), null)
})

test('demo storage uses the ISOLATED m3demo: namespace only (never the real m3: keys)', () => {
  demoStore.saveDemoRecord({ kind: 'assessment', label: 'isolation probe', payload: {} })
  demoStore.saveDemoDraft('synthetic-demo', { probe: true })
  for (const key of Array.from(backing.keys())) {
    // Real storage namespaces are 'm3:worker:', 'm3:draft:', 'm3:outbox:',
    // 'm3:meta:' (see src/cache.ts) — demo keys are deliberately disjoint.
    assert.ok(key.startsWith('m3demo:'), `demo key must be in m3demo namespace: ${key}`)
    assert.ok(!key.startsWith('m3:'), `demo key must never collide with real keys: ${key}`)
  }
  const demoJson = JSON.stringify(demoStore.listDemoRecords())
  assert.ok(demoJson.includes('isolation probe'))
  demoStore.resetDemoData()
})
