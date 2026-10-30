import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { I18nextProvider } from 'react-i18next';
import i18n, { initI18n } from '@/i18n';
import { useSession } from '@/store/session';
import { palette } from '@/theme';

export default function RootLayout() {
  const hydrate = useSession((s) => s.hydrate);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    initI18n();
    void hydrate().finally(() => setBooted(true));
  }, [hydrate]);

  if (!booted) return null;

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: palette.primary },
            headerTintColor: palette.textOnColor,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: palette.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="language" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="(worker)" options={{ headerShown: false }} />
        </Stack>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}
