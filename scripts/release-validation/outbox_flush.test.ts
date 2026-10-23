// Release-validation Phase 3: scenario tests for the REAL shared outbox flush
// logic (src/outbox.ts). The I/O seams (api transport, cache store, app store)
// are mocked in-memory; the flush/retry/idempotency algorithm under test is
// byte-for-byte the production implementation used by intake + dashboard.
//
// Run: node --test --experimental-test-module-mocks tests/outbox_flush.test.ts
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url)) // script dir
const MOBILE_SRC = (rel: string) => pathToFileURL(`${here}../../apps/mobile/src/${rel}`).href

// ---- in-memory cache mock -------------------------------------------------
let outbox: any[] = []
let clearedPending: Array<{ ownerId: string; crid: string; kind: string }> = []
let deletedDrafts: string[] = []

function resetState() {
  outbox = []
  clearedPending = []
  deletedDrafts = []
}
function enqueue(ownerId: string, kind: string, payload: Record<string, unknown>, status = 'queued') {
  const item = { id: `${ownerId}_${outbox.length + 1}`, ownerId, kind, payload, status, error: null, created_at: Date.now() }
  outbox.push(item)
  return item
}

type ApiCall = { path: string; token: string | undefined; body: string | undefined }
let apiCalls: ApiCall[] = []
let apiBehavior: (call: ApiCall, index: number) => Promise<unknown> = async () => ({})

mock.module(MOBILE_SRC('api.ts'), {
  namedExports: {
    api: (path: string, token: string | undefined, opts?: { method?: string; body?: string }) => {
      const call = { path, token, body: opts?.body }
      apiCalls.push(call)
      return apiBehavior(call, apiCalls.length)
    },
  },
})

mock.module(MOBILE_SRC('cache.ts'), {
  namedExports: {
    readOutbox: (ownerId: string) => outbox.filter((i) => i.ownerId === ownerId),
    setOutboxStatus: (id: string, status: string, message: string | null) => {
      const item = outbox.find((i) => i.id === id)
      if (item) { item.status = status; item.error = message }
    },
    removeOutbox: (id: string) => { outbox = outbox.filter((i) => i.id !== id) },
    outboxCount: (ownerId: string, status?: string) =>
      outbox.filter((i) => i.ownerId === ownerId && (!status || i.status === status)).length,
    clearPendingRequestId: (ownerId: string, crid: string, kind: string) => clearedPending.push({ ownerId, crid, kind }),
    deleteDraft: (ownerId: string) => deletedDrafts.push(ownerId),
    isAuthError: (message: string) => /\(401\)|Session expired|Unauthorized/i.test(message),
  },
})

// Minimal app-store mock: online by default, trackable session.
let storeState: any = { online: true, session: { user: { id: 'u1' } } }
mock.module(MOBILE_SRC('store.ts'), {
  namedExports: {
    useAppStore: {
      getState: () => storeState,
      setState: (patch: any) => { storeState = { ...storeState, ...patch } },
      subscribe: () => () => {},
    },
  },
})

// ---- import REAL flush logic (after mocks are registered) ----------------
const { flushOutbox, isFlushInProgress } = await import(MOBILE_SRC('outbox.ts'))
const flush = flushOutbox as (ownerId: string, token?: string, opts?: { demo?: boolean; onCounts?: (q: number, f: number) => void }) => Promise<any>

// ---- scenarios ------------------------------------------------------------
test('S1 online flush drains queue oldest-first and records server ack', async () => {
  resetState()
  apiCalls = []
  const order: string[] = []
  apiBehavior = async (call) => { order.push(call.path); return { id: 'srv1' } }
  enqueue('ownerA', 'questionnaire_submit', { data: {}, client_request_id: 'crid-1' })
  enqueue('ownerA', 'symptom_report', { data: {}, client_request_id: 'crid-2' })

  let counts: Array<[number, number]> = []
  const result = await flush('ownerA', 'token-1', { onCounts: (q, f) => counts.push([q, f]) })

  assert.equal(result.attempted, 2)
  assert.equal(result.succeeded, 2)
  assert.equal(result.failed, 0)
  // questionnaire_submit -> POST /questionnaires/submit; symptom_report -> POST /symptom-reports
  assert.deepEqual(order, ['/questionnaires/submit', '/symptom-reports'], 'items replayed oldest-first')
  assert.equal(outbox.length, 0, 'queue drained after authoritative ack')
  assert.deepEqual(deletedDrafts, ['ownerA', 'ownerA'], 'draft deleted only after server acceptance')
  assert.equal(clearedPending.length, 2, 'both pending idempotency keys retired')
  assert.deepEqual(counts.at(-1), [0, 0], 'final counts queued=0 failed=0')
})

test('S2 offline (store.online=false) is a no-op: queue and drafts untouched', async () => {
  resetState()
  apiCalls = []
  storeState = { online: false, session: { user: { id: 'u1' } } }
  enqueue('ownerB', 'questionnaire_submit', { data: {}, client_request_id: 'crid-off' })
  const result = await flush('ownerB', 'token-1')

  assert.deepEqual(result, { attempted: 0, succeeded: 0, failed: 0, authBlocked: false })
  assert.equal(apiCalls.length, 0, 'no network traffic while offline')
  assert.equal(outbox.length, 1, 'queued item preserved verbatim')
  assert.equal(deletedDrafts.length, 0, 'draft NOT deleted while offline')
  storeState = { online: true, session: storeState.session }
})

test('S3 transport failure keeps item queued + draft intact, stops flush', async () => {
  resetState()
  apiCalls = []
  apiBehavior = async (call, i) => {
    if (i === 1) throw new Error('Network request failed')
    return { id: 'srv' }
  }
  enqueue('ownerC', 'questionnaire_submit', { data: {}, client_request_id: 'crid-t' })
  enqueue('ownerC', 'questionnaire_submit', { data: {}, client_request_id: 'crid-t2' })

  const result = await flush('ownerC', 'token-1')
  assert.equal(result.attempted, 1, 'flush stops at first transport failure')
  assert.equal(result.succeeded, 0)
  const failedItem = outbox.find((i) => i.payload.client_request_id === 'crid-t')
  assert.equal(failedItem.status, 'queued', 'item returned to durably-queued state for retry')
  assert.equal(outbox.find((i) => i.payload.client_request_id === 'crid-t2').status, 'queued', 'later items untouched')
  assert.equal(deletedDrafts.length, 0, 'draft preserved on transport failure')
})

test('S4 auth error marks item failed with authBlocked=true and keeps queue', async () => {
  resetState()
  apiCalls = []
  apiBehavior = async () => { throw new Error('(401) Unauthorized: session expired') }
  enqueue('ownerD', 'questionnaire_submit', { data: {}, client_request_id: 'crid-a' })
  enqueue('ownerD', 'questionnaire_submit', { data: {}, client_request_id: 'crid-a2' })

  const result = await flush('ownerD', 'token-1')
  assert.equal(result.failed, 1)
  assert.equal(result.authBlocked, true, 'auth error surfaced for re-login flow')
  assert.equal(outbox.filter((i) => i.status !== 'failed').length, 1, 'second item still queued for replay after re-auth')
  assert.equal(deletedDrafts.length, 0, 'draft not deleted when server rejected')
})

test('S5 permanent validation rejection marks failed and continues replay', async () => {
  resetState()
  apiCalls = []
  apiBehavior = async (call, i) => {
    if (i === 1) throw new Error('(422) Validation failed: required field missing')
    return { id: 'srv' }
  }
  enqueue('ownerE', 'questionnaire_submit', { data: {}, client_request_id: 'crid-v' })
  enqueue('ownerE', 'symptom_report', { data: {}, client_request_id: 'crid-v2' })

  const result = await flush('ownerE', 'token-1')
  assert.equal(result.succeeded, 1, 'valid item after rejected one still syncs')
  assert.equal(result.failed, 1)
  assert.equal(outbox.find((i) => i.payload.client_request_id === 'crid-v').status, 'failed', 'rejected item parked as failed for user review')
  assert.notEqual(result.authBlocked, true, 'validation failure is not treated as an auth failure')
  // Draft lifecycle: the shared per-owner draft is deleted only after a server
  // acceptance (the rejected item itself never triggers draft deletion).
  assert.equal(deletedDrafts.length, 1, 'draft deleted only by the accepted item')
})

test('S6 duplicate-ack counts as success: retry never creates duplicates', async () => {
  resetState()
  apiCalls = []
  // Server answers with a duplicate marker (idempotent replay), no throw.
  apiBehavior = async () => ({ id: 'srv1', duplicate: true })
  enqueue('ownerF', 'questionnaire_submit', { data: {}, client_request_id: 'crid-dup' })
  const first = await flush('ownerF', 'token-1')
  assert.equal(first.succeeded, 1)
  assert.equal(outbox.length, 0)
  assert.equal(apiCalls.length, 1, 'client_request_id carried to server exactly once per attempt')
  // Simulated second press of replay after ambiguous outcome: queue empty -> no further writes
  const second = await flush('ownerF', 'token-1')
  assert.equal(second.attempted, 0, 'replay after ack is a no-op (no duplicate creation)')
})

test('S7 flush is single-flight and requires identity + online session', async () => {
  resetState()
  apiCalls = []
  let gate: (() => void) | null = null
  const ready = new Promise<void>((r) => { gate = r })
  apiBehavior = async () => { await ready; return { id: 'srv' } }
  enqueue('ownerG', 'symptom_report', { data: {}, client_request_id: 'crid-sf' })

  const p1 = flush('ownerG', 'token-1')
  const concurrent = await flush('ownerG', 'token-1')
  assert.deepEqual(concurrent, { attempted: 0, succeeded: 0, failed: 0, authBlocked: false }, 'second call during in-flight flush is a no-op')
  assert.equal(isFlushInProgress(), true, 'in-flight flag set')
  ;(gate as unknown as () => void)()
  const done = await p1
  assert.equal(done.succeeded, 1)
  assert.equal(isFlushInProgress(), false, 'in-flight flag cleared')

  const demo = await flush('ownerG', 'token-1', { demo: true })
  assert.equal(demo.attempted, 0, 'demo mode never hits the network')
  const anon = await flush('ownerG')
  assert.equal(anon.attempted, 0, 'no token -> no replay (identity-bound)')
})

test('S8 per-owner isolation: one owner never flushes another queue', async () => {
  resetState()
  apiCalls = []
  apiBehavior = async () => ({ id: 'srv' })
  enqueue('ownerH', 'questionnaire_submit', { data: {}, client_request_id: 'crid-H' })
  enqueue('ownerI', 'questionnaire_submit', { data: {}, client_request_id: 'crid-I' })

  await flush('ownerH', 'token-1')
  assert.equal(apiCalls.length, 1, 'only ownerH item replayed')
  assert.equal(apiCalls[0].body && JSON.parse(apiCalls[0].body).client_request_id, 'crid-H', 'replayed payload belongs to ownerH')
  assert.equal(outbox.filter((i) => i.ownerId === 'ownerI').length, 1, "ownerI's item untouched")
  assert.deepEqual(clearedPending.filter((c) => c.ownerId === 'ownerI'), [], "ownerI's pending key never cleared by ownerH replay")
})
