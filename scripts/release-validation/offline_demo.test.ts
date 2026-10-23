// Release-validation Phase 8: Offline Demo Mode isolation harness.
//
// Proves the SAFETY PROPERTIES of demo mode with the real demo data/store code
// and the real outbox flush algorithm, while the I/O seams (api transport, the
// REAL SQLite cache/outbox/drafts layer, app store) are mocked in memory:
//
//  1. demo init + role bootstrap make ZERO network calls (no server, no laptop)
//  2. all seven demo roles get a valid no-token demo identity
//  3. demo writes (drafts/records/activity) never touch the real outbox or the
//     real draft store (enqueueOutbox/saveDraft spies stay at zero)
//  4. connectivity returning does NOT upload demo data (flush no-ops in demo)
//  5. mode switching does not merge demo and real identities or queues
//  6. demo namespace reset cannot wipe real storage (m3:* keys survive)
//  7. the existing ONLINE flush path still works (regression guard)
//
// Run: node --import ./ts_loader.mjs --test --experimental-test-module-mocks offline_demo.test.ts
// (from scripts/release-validation)
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const MOBILE_SRC = (rel: string) => pathToFileURL(`${here}../../apps/mobile/src/${rel}`).href

// ---- shared memory ("localStorage") shim -------------------------------------
// Installed BEFORE demoStore is imported so its environment detection picks the
// web/localStorage backend (node must never lazily require expo-sqlite).
// Two keyspaces live side by side: real `m3:*` keys and demo `m3demo:*` keys,
// so reset-isolation can be proven on the very same storage.
const LS = new Map<string, string>()
const localStorageShim = {
  getItem: (k: string) => (LS.has(k) ? LS.get(k)! : null),
  setItem: (k: string, v: string) => { LS.set(k, String(v)) },
  removeItem: (k: string) => { LS.delete(k) },
  key: (i: number) => Array.from(LS.keys())[i] ?? null,
  get length() { return LS.size },
  clear: () => { LS.clear() },
}
;(globalThis as any).localStorage = localStorageShim
;(globalThis as any).window = { localStorage: localStorageShim }

const m3 = (k: string, v?: string | null) => {
  if (v === undefined) return LS.get(`m3:${k}`) ?? null
  if (v === null) { LS.delete(`m3:${k}`); return null }
  LS.set(`m3:${k}`, v)
  return v
}

// ---- counting network transport ---------------------------------------------
// Every HTTP call is RECORDED and then rejected unless the test explicitly opens
// the gate (only the online-regression scenario does). A leaked demo call can
// therefore never succeed silently: it fails the test by count, and if it
// slips past a count it fails loudly in the flush algorithm itself.
type ApiCall = { path: string; token: string | undefined; method: string; body: string | undefined }
let apiCalls: ApiCall[] = []
let networkOpen = false

function resetNetwork() {
  apiCalls = []
  networkOpen = false
}

mock.module(MOBILE_SRC('api.ts'), {
  namedExports: {
    api: async (path: string, token: string | undefined, opts?: { method?: string; body?: string }) => {
      const call: ApiCall = { path, token, method: opts?.method ?? 'GET', body: opts?.body }
      apiCalls.push(call)
      if (!networkOpen) throw new Error(`(999) DEMO-HARNESS: unexpected network call ${call.method} ${path}`)
      return { id: `srv-${apiCalls.length}` }
    },
  },
})

// ---- REAL cache/outbox layer seam -------------------------------------------
// Spies on the write side prove demo mode never reaches the real store; an
// in-memory outbox lets us verify the online flush path still works.
let outbox: any[] = []
let draftsByOwner: Record<string, any> = {}
let calls = {
  enqueueOutbox: [] as Array<{ ownerId: string; kind: string }>,
  saveDraft: [] as string[],
  deleteDraft: [] as string[],
  writeWorkers: [] as string[],
}
function resetMockStore() {
  outbox = []
  draftsByOwner = {}
  calls = { enqueueOutbox: [], saveDraft: [], deleteDraft: [], writeWorkers: [] }
}

mock.module(MOBILE_SRC('cache.ts'), {
  namedExports: {
    initCache: () => {},
    readOutbox: (ownerId: string) => outbox.filter((i) => i.ownerId === ownerId),
    setOutboxStatus: (id: string, status: string, error: string | null, attemptsDelta = 0) => {
      const item = outbox.find((i) => i.id === id)
      if (item) { item.status = status; item.error = error; item.attempts += attemptsDelta }
    },
    removeOutbox: (id: string) => { outbox = outbox.filter((i) => i.id !== id) },
    outboxCount: (ownerId: string, status?: string) =>
      outbox.filter((i) => i.ownerId === ownerId && (!status || i.status === status)).length,
    enqueueOutbox: (ownerId: string, kind: string, payload: any) => {
      calls.enqueueOutbox.push({ ownerId, kind })
      const item = { id: `${ownerId}_${outbox.length + 1}`, ownerId, kind, payload, status: 'queued', error: null, attempts: 0, created_at: Date.now() }
      outbox.push(item)
      return item
    },
    saveDraft: (ownerId: string, data: any) => { calls.saveDraft.push(ownerId); draftsByOwner[ownerId] = data },
    readDraft: (ownerId: string) => draftsByOwner[ownerId] ?? null,
    deleteDraft: (ownerId: string) => { calls.deleteDraft.push(ownerId); delete draftsByOwner[ownerId] },
    writeWorkers: (ownerId: string) => { calls.writeWorkers.push(ownerId) },
    readWorkers: (_ownerId: string) => [],
    clearOwner: (_ownerId: string) => {},
    getPendingRequestId: () => null,
    setPendingRequestId: () => {},
    clearPendingRequestId: (ownerId: string, crid: string, kind: string) => { void ownerId; void crid; void kind },
    isAuthError: (message: string) => /\(401\)|Session expired|Unauthorized/i.test(message),
    DEMO_OWNER: 'synthetic-demo',
  },
})

// ---- app store mock ----------------------------------------------------------
let storeState: any = { online: true, session: { token: undefined, demo: false, user: { id: 'u1' } } }
mock.module(MOBILE_SRC('store.ts'), {
  namedExports: {
    useAppStore: {
      getState: () => storeState,
      setState: (patch: any) => { storeState = { ...storeState, ...patch } },
      subscribe: () => () => {},
    },
  },
})

// ---- import REAL demo code + REAL flush logic (after mocks) -----------------
const demoData: any = await import(MOBILE_SRC('demoData.ts'))
const demoStore: any = await import(MOBILE_SRC('demoStore.ts'))
const { flushOutbox }: any = await import(MOBILE_SRC('outbox.ts'))

const roles: string[] = demoData.DEMO_ROLES.map((r: any) => r.role)
const DEMO_USER_ID: string = demoData.DEMO_USER_ID

// ---- helpers -----------------------------------------------------------------
function beforeEach() {
  LS.clear()
  resetMockStore()
  resetNetwork()
  storeState = { online: true, session: { token: undefined, demo: false, user: { id: 'u1' } } }
}

// ---- scenarios ---------------------------------------------------------------

test('S1 demo init + all seven roles bootstrap with ZERO network calls', async () => {
  beforeEach()
  demoStore.initDemoStore()
  // everything a demo boot touches, in one battery, with no server anywhere
  demoData.demoWorkers()
  demoData.demoSites()
  demoData.demoRoster('SYN-01')
  demoData.demoFacilities()
  demoData.demoCases()
  demoData.demoAssessments()
  demoData.demoSamples()
  demoData.demoFollowups()
  demoData.demoHealthWorkerOptions()
  demoData.demoResearchAggregates()
  demoData.demoAuditEvents()
  for (const role of roles) {
    demoData.demoSessionFor(role as any)
    demoData.demoDashboardMetrics(role as any)
  }
  const anonFlush = await flushOutbox(DEMO_USER_ID, undefined, { demo: true })
  assert.deepEqual(anonFlush, { attempted: 0, succeeded: 0, failed: 0, authBlocked: false })
  assert.equal(apiCalls.length, 0, 'no HTTP request ever leaves the device in demo mode')
})

test('S2 every demo role gets a no-token identity that cannot pass as real auth', () => {
  beforeEach()
  const realUser = { id: 'M3-real-agent-4' }
  for (const role of roles) {
    const s = demoData.demoSessionFor(role as any)
    assert.equal(s.token, undefined, `${role}: no token (cannot authorize against a real server)`)
    assert.equal(s.demo, true, `${role}: session stamped demo`)
    assert.equal(s.user.id, DEMO_USER_ID, `${role}: synthetic identity, not a real account id`)
    assert.notEqual(s.user.id, realUser.id)
    assert.deepEqual(s.user.roles, [role], `${role}: demo roles are explicit and single`)
    assert.equal(s.user.demo_stamp, 'demo')
  }
  assert.equal(roles.length, 7, 'all seven role experiences represented')
  assert.equal(roles.includes('real'), false)
})

test('S3 demo writes never reach the real outbox / drafts / worker cache', async () => {
  beforeEach()
  demoStore.initDemoStore()
  demoStore.setActiveDemoRole('worker')
  demoStore.saveDemoDraft(DEMO_USER_ID, { personal: { first_name: 'Synthetic', last_name: 'Demo A' } })
  const rec = demoStore.saveDemoRecord({
    kind: 'questionnaire_submit',
    label: 'Synthetic Participant A — demo questionnaire',
    payload: { patient_code: 'M3-SYN-XXXX', demo_stamp: 'demo' },
  })
  demoStore.saveDemoActivity('Demo note', 'synthetic only')

  assert.equal(rec.status, 'demo_saved_locally', 'demo records carry the synthetic status, not a sync status')
  assert.match(String(rec.label), /Synthetic/, 'demo records are unambiguously labelled')
  assert.equal(calls.enqueueOutbox.length, 0, 'demo writes NEVER enqueue into the real outbox')
  assert.equal(calls.saveDraft.length, 0, 'demo drafts NEVER touch the real draft table')
  assert.equal(calls.writeWorkers.length, 0, 'demo browsing never writes the worker cache')
  assert.equal(outbox.length, 0, 'real (mocked) outbox untouched')
  assert.deepEqual(Object.keys(draftsByOwner), [], 'real (mocked) draft store untouched')
  assert.equal(apiCalls.length, 0, 'and nothing was sent to any server')

  // the demo write is nonetheless durably readable (restart-surviving store)
  assert.ok(demoStore.readDemoDraft(DEMO_USER_ID), 'demo draft persisted in the demo namespace')
  assert.equal(demoStore.listDemoRecords().length, 1)
  assert.equal(demoStore.listDemoActivity().length, 2, 'record auto-logged activity + explicit note')
})

test('S4 demo store persists across simulated restarts and drafts stay distinct from completed records', async () => {
  beforeEach()
  demoStore.initDemoStore()
  demoStore.setActiveDemoRole('pathologist')
  demoStore.saveDemoDraft(DEMO_USER_ID, { kind_plan: 'unfinished demo questionnaire' })
  demoStore.saveDemoRecord({ kind: 'symptom_report', label: 'Synthetic symptom report A', payload: {} })

  // every byte of demo state is persisted under the demo namespace — nothing relies on module memory
  const persisted = [...LS.keys()]
  assert.ok(persisted.length >= 3, 'state persisted to storage')
  assert.ok(persisted.every((k) => k.startsWith('m3demo:')), 'demo state persisted under the demo namespace only')
  assert.ok(persisted.includes('m3demo:meta:activeRole'), 'active demo role is persisted, not in-memory')

  // simulated app restart: identical storage, brand-new module instance (fresh
  // singletons) recovers the whole demo session and all demo work
  const restarted: any = await import(MOBILE_SRC('demoStore.ts') + '?restart=1')
  assert.equal(restarted.getActiveDemoRole(), 'pathologist', 'demo session restored without any token keystore')
  const draft = restarted.readDemoDraft(DEMO_USER_ID)
  assert.ok(draft?.updated_at, 'draft carries a local timestamp')
  const records = restarted.listDemoRecords()
  assert.equal(records.length, 1)
  assert.equal(records[0].status, 'demo_saved_locally', 'completed demo work keeps its distinct status')
  assert.match(records[0].created_at, /^\d{4}-\d{2}-\d{2}T/, 'record carries an ISO local timestamp')
  assert.equal(restarted.listDemoRecords('questionnaire_submit').length, 0, 'kind filter stays exact')
  assert.equal(restarted.listDemoRecords('symptom_report').length, 1)
})

test('S5 connectivity returning does NOT upload demo data, even with a forged token present', async () => {
  beforeEach()
  demoStore.initDemoStore()
  demoStore.saveDemoRecord({ kind: 'symptom_report', label: 'Synthetic Participant A — symptom report', payload: { demo: true } })
  demoStore.saveDemoDraft(DEMO_USER_ID, { personal: {} })
  const recordsBefore = demoStore.listDemoRecords().length
  const draftBefore = demoStore.readDemoDraft(DEMO_USER_ID)

  storeState = { online: true, session: { token: 'forged-real-token', demo: true, user: { id: DEMO_USER_ID } } }
  // every way the app could try to replay: demo flag, no flag, no token
  const r1 = await flushOutbox(DEMO_USER_ID, 'forged-real-token', { demo: true })
  const r2 = await flushOutbox(DEMO_USER_ID, 'forged-real-token')
  const r3 = await flushOutbox(DEMO_USER_ID, undefined)
  for (const r of [r1, r2, r3]) {
    assert.deepEqual(r, { attempted: 0, succeeded: 0, failed: 0, authBlocked: false }, 'flush is a no-op in demo mode')
  }
  assert.equal(apiCalls.length, 0, 'connectivity return triggered ZERO uploads of demo work')
  assert.equal(outbox.length, 0, 'no demo item ever entered the real outbox to replay')
  assert.equal(demoStore.listDemoRecords().length, recordsBefore, 'demo records intact after connectivity return')
  assert.deepEqual(demoStore.readDemoDraft(DEMO_USER_ID), draftBefore, 'demo draft untouched by the reconnect path')

  // even a demo-identity-less stray call cannot leak: demo namespace holds the data
  assert.ok(demoStore.listDemoRecords().every((r: any) => r.id.startsWith('demo-')))
})

test('S6 mode switching never merges demo and real identities, queues or drafts', async () => {
  beforeEach()
  const realOwner = 'M3-real-agent-4'
  // a real (mocked) outbox item + real draft exist BEFORE demo entry
  const { enqueueOutbox, saveDraft }: any = await import(MOBILE_SRC('cache.ts'))
  enqueueOutbox(realOwner, 'questionnaire_submit', { client_request_id: 'crid-real-1', data: {} })
  saveDraft(realOwner, { personal: { first_name: 'Real' } })
  m3('instance/config', 'http://10.2.2.2:8000') // real server config stored under m3:*

  // enter demo as another role
  demoStore.initDemoStore()
  demoStore.setActiveDemoRole('clinician')
  demoStore.saveDemoDraft(DEMO_USER_ID, { personal: { first_name: 'Synthetic' } })
  demoStore.saveDemoRecord({ kind: 'assessment', label: 'Synthetic demo assessment', payload: {} })
  await flushOutbox(realOwner, 'forged-token', { demo: true })

  const demoSession = demoData.demoSessionFor('clinician')
  assert.notEqual(demoSession.user.id, realOwner, 'demo identity is not the real account')
  assert.equal(demoSession.token, undefined, 'entering demo obtained NO real credential')

  // leave demo
  demoStore.setActiveDemoRole(null)
  assert.equal(demoStore.getActiveDemoRole(), null, 'no persisted demo role after exit')
  assert.equal(outbox.filter((i) => i.ownerId === realOwner).length, 1, "real outbox item NOT cleared by entering/leaving demo")
  assert.equal(calls.deleteDraft.filter((o) => o === realOwner).length, 0, 'real draft never deleted by demo lifecycle')
  assert.ok(draftsByOwner[realOwner], 'real draft survived the demo round-trip')
  assert.equal(JSON.stringify([...LS.keys()].filter((k) => k.startsWith('m3:'))).includes('instance/config'), true, 'real m3:* config survived')
  assert.equal(demoStore.readDemoDraft(DEMO_USER_ID).personal.first_name, 'Synthetic', 'demo draft still namespaced under synthetic identity')
  assert.equal(apiCalls.length, 0, 'no network in either direction across the mode switch')
})

test('S7 demo reset wipes ONLY the demo namespace; real storage untouched', () => {
  beforeEach()
  m3('instance/config', 'http://10.2.2.2:8000')
  m3('pending/questionnaire', 'crid-real-2')
  demoStore.initDemoStore()
  demoStore.setActiveDemoRole('health_worker')
  demoStore.saveDemoDraft(DEMO_USER_ID, {})
  demoStore.saveDemoRecord({ kind: 'followup', label: 'Synthetic demo followup', payload: {} })
  demoStore.saveDemoActivity('demo action', 'synthetic')

  demoStore.resetDemoData()

  assert.equal(LS.has('m3:instance/config'), true, 'real server config untouched by demo reset')
  assert.equal(LS.has('m3:pending/questionnaire'), true, 'real idempotency marker untouched by demo reset')
  assert.equal(m3('instance/config'), 'http://10.2.2.2:8000')
  assert.equal(demoStore.listDemoRecords().length, 0, 'demo records wiped')
  assert.equal(demoStore.readDemoDraft(DEMO_USER_ID), null, 'demo drafts wiped')
  assert.equal(demoStore.getActiveDemoRole(), null, 'demo session marker wiped')
  assert.equal(apiCalls.length, 0, 'reset is a local operation, never a server call')
})

test('S8 existing ONLINE flush path unaffected by demo-mode changes (regression)', async () => {
  beforeEach()
  demoStore.initDemoStore() // demo infra active alongside a real session — must not interfere
  const { enqueueOutbox }: any = await import(MOBILE_SRC('cache.ts'))
  enqueueOutbox('u1', 'questionnaire_submit', { client_request_id: 'crid-online-1', data: {} })
  assert.equal(apiCalls.length, 0)
  networkOpen = true // explicit: only this scenario authorizes the transport
  const result = await flushOutbox('u1', 'token-1')
  networkOpen = false
  assert.equal(result.succeeded, 1, 'online flush still replays and acks')
  assert.equal(apiCalls.length, 1, 'exactly one real submission')
  assert.equal(apiCalls[0].token, 'token-1', 'real submission carries the REAL session token')
  assert.equal(apiCalls[0].path, '/questionnaires/submit')
  assert.equal(outbox.length, 0, 'queue drained after ack')
})
