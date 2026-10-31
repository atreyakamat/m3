import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/store/session';
import { palette } from '@/theme';

export default function WorkerLayout() {
  const { ready, token } = useSession();
  const { t } = useTranslation();
  if (!ready) return null;
  if (!token) return <Redirect href="/language" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.primary },
        headerTintColor: palette.textOnColor,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: palette.bg },
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: t('dashboard.title'), headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: t('nav.profile') }} />
      <Stack.Screen name="screening" options={{ title: t('nav.screening') }} />
      <Stack.Screen name="site" options={{ title: t('nav.site') }} />
      <Stack.Screen name="travel" options={{ title: t('nav.travel') }} />
      <Stack.Screen name="transfer" options={{ title: t('nav.transfer') }} />
      <Stack.Screen name="malaria" options={{ title: t('nav.malaria') }} />
      <Stack.Screen name="prescriptions" options={{ title: t('nav.prescriptions') }} />
      <Stack.Screen name="unwell" options={{ title: t('nav.feelingUnwell') }} />
      <Stack.Screen name="followups" options={{ title: t('nav.followUps') }} />
    </Stack>
  );
}
