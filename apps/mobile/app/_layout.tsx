import { useEffect } from 'react'
import { Stack } from 'expo-router'
import * as Network from 'expo-network'
import { initCache, readMeta } from '@/src/cache'
import { initBaseUrl } from '@/src/api'
import { useAppStore } from '@/src/store'
import { NotificationBell } from '@/components/NotificationBell'

export default function Layout() {
  const setOnline = useAppStore((x) => x.setOnline)
  // Task 1: restore the runtime-configured LAN-IP / tunnel API target.
  const setCustomServerUrl = useAppStore((x) => x.setCustomServerUrl)

  useEffect(() => {
    initCache()
    initBaseUrl()
    const storedServer = readMeta('customServerUrl')
    if (storedServer) setCustomServerUrl(storedServer)
    Network.getNetworkStateAsync().then((s) =>
      setOnline(Boolean(s.isConnected || s.isInternetReachable))
    )
    const sub = Network.addNetworkStateListener((s) =>
      setOnline(Boolean(s.isConnected || s.isInternetReachable))
    )
    return () => sub.remove()
  }, [setOnline, setCustomServerUrl])

  // Task 6: accessible medical header (teal surface, white text).
  // Task 7: NotificationBell mounted in the right header position.
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f766e' },
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
