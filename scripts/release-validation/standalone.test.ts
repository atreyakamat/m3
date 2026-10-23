// Release-validation: Standalone Local Server mode harness (no remote leak).
//
// Proves the SAFETY PROPERTIES of the standalone local-server URL plumbing in
// the REAL src/api.ts (the same module the shipping app runs), while the I/O
// seams (cache_meta storage, react-native platform constants, secure store,
// app store) are mocked in memory:
//
//  1. with a previously-configured remote server URL saved, entering local
//     mode forces EVERY request to the loopback embedded backend
//  2. no request in local mode ever touches the saved remote URL, the LAN
//     default (10.0.2.2) or any non-loopback host
//  3. exiting local mode restores the saved remote URL EXACTLY as it was
//     (never deleted/rewritten by local mode)
//  4. the persisted localMode flag survives an app restart (initBaseUrl)
//  5. the loopback target is exactly 127.0.0.1:<LOCAL_SERVER_PORT> and never
//     a wildcard/all-interfaces alias
//  6. regression: the ONLINE resolution chain (stored URL → env → Android
//     emulator default) is unchanged when local mode is off
//
// Run: node --import ./ts_loader.mjs --test standalone.test.ts
// (from scripts/release-validation)
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const MOBILE_SRC = (rel: string) => pathToFileURL(`${here}../../apps/mobile/src/${rel}`).href
/** Bare package specifiers are not resolvable from scripts/; resolve through
 * apps/mobile's own node_modules and mock by the resolved file URL. */
const mobileResolve = (spec: string) =>
  pathToFileURL(createRequire(pathToFileURL(`${here}../../apps/mobile/package.json`)).resolve(spec)).href

// ---- cache_meta shim (the real persistence seam of api.ts) --------------------
const META = new Map<string, string>()

mock.module(MOBILE_SRC('cache.ts'), {
  namedExports: {
    initCache: () => {},
    readMeta: (key: string) => (META.has(key) ? META.get(key)! : null),
    writeMeta: (key: string, value: string) => { META.set(key, String(value)) },
    deleteMeta: (key: string) => { META.delete(key) },
    // Not used by api.ts, but exported so any incidental import resolves.
    DEMO_OWNER: 'synthetic-demo',
  },
})

// ---- platform constants mock ---------------------------------------------------
// api.ts only reads Platform.OS; react-native itself must never be evaluated
// in node (react-native entry is Flow/unparseable).
mock.module(mobileResolve('react-native'), {
  namedExports: {
    Platform: { OS: 'android', select: (o: any) => o.android },
    NativeModules: {},
  },
})

mock.module(mobileResolve('expo-secure-store'), {
  namedExports: {
    getItemAsync: async () => null,
    setItemAsync: async () => {},
    deleteItemAsync: async () => {},
  },
})

// ---- app store mock (401 hook only) -------------------------------------------
let sessionExpiredMarks = 0
mock.module(MOBILE_SRC('store.ts'), {
  namedExports: {
    useAppStore: {
      getState: () => ({
        markSessionExpired: () => { sessionExpiredMarks += 1 },
      }),
      setState: () => {},
      subscribe: () => () => {},
    },
  },
})

// ---- counting fetch ------------------------------------------------------------
// EVERY HTTP call is recorded. A leaked standalone-mode call to any non-loopback
// host fails the test by URL assertion — it can never succeed silently because
// there is no remote to succeed against here.
type FetchCall = { url: string; init: any }
let fetchCalls: FetchCall[] = []
;(globalThis as any).fetch = async (url: any, init: any) => {
  fetchCalls.push({ url: String(url), init })
  return {
    ok: true,
    status: 200,
    headers: { get: (_k: string) => null },
    json: async () => ({ harness: true }),
    text: async () => JSON.stringify({ harness: true }),
  }
}

const resetAll = () => {
  META.clear()
  fetchCalls = []
  sessionExpiredMarks = 0
  // EXPO_PUBLIC_API_BASE_URL must not leak from the invoking shell.
  delete process.env.EXPO_PUBLIC_API_BASE_URL
}

// ---- import the REAL api module (after mocks) ----------------------------------
const apiMod: any = await import(MOBILE_SRC('api.ts'))
const {
  initBaseUrl, setLocalMode, isLocalMode, localApiBase, applyServerUrl,
  LOCAL_SERVER_PORT, base, api,
} = apiMod

const LOOPBACK = `http://127.0.0.1:${LOCAL_SERVER_PORT}/api/v1`
const REMOTE = 'http://192.168.1.116:8003/api/v1'

test('local mode forces the loopback base even with a saved remote URL', () => {
  resetAll()
  META.set('customServerUrl', REMOTE)
  // Baseline: online mode resolves the stored remote URL.
  assert.equal(initBaseUrl(), REMOTE)
  assert.equal(isLocalMode(), false)

  assert.equal(setLocalMode(true), LOOPBACK)
  assert.equal(base(), LOOPBACK)
  assert.equal(isLocalMode(), true)
  // The stored remote URL is NOT rewritten or deleted by entering local mode.
  assert.equal(META.get('customServerUrl'), REMOTE)
})

test('no request in local mode ever leaves the device (loopback only)', async () => {
  resetAll()
  META.set('customServerUrl', REMOTE)
  setLocalMode(true)

  await api('/auth/login', undefined, { method: 'POST', body: '{}' })
  await api('/me', 'tok-123')
  await api('/questionnaires/submit', 'tok-123', {
    method: 'POST',
    headers: { 'X-Request-ID': 'crid-harness-1' },
    body: '{"data":{}}',
  })
  assert.ok(fetchCalls.length >= 3)
  for (const call of fetchCalls) {
    assert.ok(
      call.url.startsWith('http://127.0.0.1:'),
      `standalone request leaked: ${call.url}`,
    )
    assert.ok(call.url.startsWith(LOOPBACK), `wrong loopback root: ${call.url}`)
    assert.ok(!call.url.includes('192.168.1.116'), `remote host hit: ${call.url}`)
    assert.ok(!call.url.includes('10.0.2.2'), `emulator LAN default hit: ${call.url}`)
  }
  // No 401 degradation side effects from the happy-path calls.
  assert.equal(sessionExpiredMarks, 0)
})

test('exiting local mode restores the saved remote URL unchanged', () => {
  resetAll()
  META.set('customServerUrl', REMOTE)
  setLocalMode(true)
  assert.equal(isLocalMode(), true)

  assert.equal(setLocalMode(false), REMOTE)
  assert.equal(initBaseUrl(), REMOTE)
  assert.equal(isLocalMode(), false)
  // The persisted switch was cleared, the remote URL was never touched.
  assert.equal(META.has('localMode'), false)
  assert.equal(META.get('customServerUrl'), REMOTE)
})

test('localMode flag persists across an app restart (initBaseUrl)', () => {
  resetAll()
  META.set('customServerUrl', REMOTE)
  setLocalMode(true)
  // Fresh app boot: cache_meta is repopulated by the storage layer, and
  // initBaseUrl() re-reads the persisted flag before any UI starts the server.
  assert.equal(META.get('localMode'), '1')
  assert.equal(initBaseUrl(), LOOPBACK)
  assert.equal(isLocalMode(), true)
  assert.equal(base(), LOOPBACK)
})

test('loopback target is strictly 127.0.0.1 and never an all-interfaces alias', () => {
  resetAll()
  assert.match(localApiBase(), /^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/)
  assert.ok(!localApiBase().includes('0.0.0.0'))
  assert.ok(!localApiBase().includes('localhost'))
  assert.equal(LOCAL_SERVER_PORT, 8741)
})

test('regression: online resolution chain unchanged (stored URL, env, android default)', () => {
  resetAll()
  // 1. Priority 1: stored custom URL.
  META.set('customServerUrl', REMOTE)
  assert.equal(initBaseUrl(), REMOTE)
  // 2. Priority 2: build-time env URL.
  META.delete('customServerUrl')
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://m3.example.org/api/v1'
  assert.equal(initBaseUrl(), 'https://m3.example.org/api/v1')
  delete process.env.EXPO_PUBLIC_API_BASE_URL
  // 3. Priority 3: android emulator default.
  assert.equal(initBaseUrl(), 'http://10.0.2.2:8003/api/v1')
  // 4. applyServerUrl round-trip still persists + restores.
  assert.equal(applyServerUrl('192.168.1.50:8003'), 'http://192.168.1.50:8003/api/v1')
  assert.equal(META.get('customServerUrl'), 'http://192.168.1.50:8003/api/v1')
  assert.equal(applyServerUrl(null), 'http://10.0.2.2:8003/api/v1')
  assert.equal(META.has('customServerUrl'), false)
})
