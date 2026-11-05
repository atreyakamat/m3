import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/store/session';
import { palette } from '@/theme';

export default function HealthWorkerLayout() {
  const { ready, token, user } = useSession();
  const { t } = useTranslation();

  if (!ready) return null;
  if (!token) return <Redirect href="/language" />;
  if (user?.role !== 'HEALTH_WORKER') return <Redirect href="/(worker)/dashboard" />;
  if (user?.credentialChangeRequired) return <Redirect href="/first-login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.primary },
        headerTintColor: palette.textOnColor,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: palette.bg },
      }}
    >
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ title: t('healthWorker.searchTitle', 'Worker Search & Care') }} />
      <Stack.Screen name="worker-detail" options={{ title: t('healthWorker.workerDetailTitle', 'Worker Surveillance Record') }} />
      <Stack.Screen name="screening" options={{ title: t('healthWorker.screeningTitle', 'Assisted Health Screening') }} />
      <Stack.Screen name="case-form" options={{ title: t('healthWorker.caseTitle', 'Suspected Malaria Case') }} />
      <Stack.Screen name="followups" options={{ title: t('healthWorker.followupsTitle', 'Pending Follow-ups') }} />
      <Stack.Screen name="arrivals" options={{ title: t('healthWorker.arrivalsTitle', 'Travel & Arrival Screening') }} />
      <Stack.Screen name="symptom-reports" options={{ title: t('healthWorker.unwellTitle', 'Feeling Unwell Reports') }} />
    </Stack>
  );
}
