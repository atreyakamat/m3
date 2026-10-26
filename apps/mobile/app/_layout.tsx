import { useEffect, useRef } from 'react'
import { Stack } from 'expo-router'
import * as Network from 'expo-network'
import { DEMO_OWNER, initCache, readMeta } from '@/src/cache'
import { initBaseUrl, isLocalMode } from '@/src/api'
import { flushOutbox } from '@/src/outbox'
import { useAppStore } from '@/src/store'
import { NotificationBell } from '@/components/NotificationBell'

export default function Layout() {
  const setOnline = useAppStore((x) => x.setOnline)
  // Task 1: restore the runtime-configured LAN-IP / tunnel API target.
  const setCustomServerUrl = useAppStore((x) => x.setCustomServerUrl)
  // Standalone Local Server mode (Phase 5): the app hosts the REAL backend.
  const setLocalMode = useAppStore((x) => x.setLocalMode)
  const session = useAppStore((x) => x.session)
  // One-shot flush-on-boot guard: replay once per restored session, never
  // re-triggered by unrelated re-renders (intake's own effect stays too;
  // src/outbox.ts serializes concurrent runs).
  const bootFlushedFor = useRef<string | null>(null)

  useEffect(() => {
    initCache()
    initBaseUrl()
    const local = isLocalMode()
    if (local) {
      setLocalMode(true)
      // The backend is on-device: connectivity state is irrelevant. Treat the
      // app as online as soon as the embedded server is running (marking which
      // happens in the standalone card on the sign-in screen).
      setOnline(true)
    }
    const storedServer = readMeta('customServerUrl')
    if (storedServer) setCustomServerUrl(storedServer)
    if (!local) {
      Network.getNetworkStateAsync().then((s) =>
        setOnline(Boolean(s.isConnected || s.isInternetReachable))
      )
      const sub = Network.addNetworkStateListener((s) =>
        setOnline(Boolean(s.isConnected || s.isInternetReachable))
      )
      return () => sub.remove()
    }
  }, [setOnline, setCustomServerUrl, setLocalMode])

  // Flush-on-boot: if a session is present and connectivity is up at launch,
  // replay anything queued from a previous run exactly once.
  useEffect(() => {
    const token = session?.token
    if (!token || session?.demo || bootFlushedFor.current === token) return
    bootFlushedFor.current = token
    try {
      flushOutbox(session?.user?.id || DEMO_OWNER, token, { demo: Boolean(session?.demo) }).catch(
        () => {
          // Non-fatal: the queue is durable and intake replays on connectivity.
        }
      )
    } catch {
      // Never block the first render on outbox replay.
    }
  }, [session])

  // Task 6: accessible medical header (teal surface, white text).
  // Task 7: NotificationBell mounted in the right header position.
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#059669' },
        headerTintColor: '#ffffff',
        contentStyle: { backgroundColor: '#f8fafc' },
        headerRight: () => <NotificationBell />,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="intake" options={{ title: 'Worker intake' }} />
      <Stack.Screen name="assessment" options={{ title: 'Clinical assessment' }} />
      <Stack.Screen name="diagnostic" options={{ title: 'Pathology' }} />
      <Stack.Screen name="followup" options={{ title: 'Follow-up' }} />
      <Stack.Screen name="research" options={{ title: 'Research lab' }} />
      <Stack.Screen name="sites" options={{ title: 'Construction sites' }} />
      <Stack.Screen name="symptom" options={{ title: 'Health report' }} />
      <Stack.Screen name="mycases" options={{ title: 'My cases' }} />
    </Stack>
  )
}
