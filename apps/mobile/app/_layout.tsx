import { useEffect } from 'react'
import { Stack } from 'expo-router'
import * as Network from 'expo-network'
import { initCache } from '@/src/cache'
import { useAppStore } from '@/src/store'
export default function Layout() {
  const setOnline = useAppStore((x) => x.setOnline)

  useEffect(() => {
    initCache()
    Network.getNetworkStateAsync().then((s) =>
      setOnline(Boolean(s.isConnected || s.isInternetReachable))
    )
    const sub = Network.addNetworkStateListener((s) =>
      setOnline(Boolean(s.isConnected || s.isInternetReachable))
    )
    return () => sub.remove()
  }, [setOnline])

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fafaf9' },
        headerTintColor: '#18181b',
        contentStyle: { backgroundColor: '#f5f5f4' },
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
