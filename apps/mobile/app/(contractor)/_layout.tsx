import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/store/session';
import { palette } from '@/theme';

export default function ContractorLayout() {
  const { ready, token, user } = useSession();
  const { t } = useTranslation();
  if (!ready) return null;
  if (!token) return <Redirect href="/language" />;
  if (user?.role !== 'CONTRACTOR') return <Redirect href="/(worker)/dashboard" />;
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
      <Stack.Screen name="profile" options={{ title: t('contractor.profile', 'Profile') }} />
      <Stack.Screen name="workers" options={{ title: t('contractor.workers', 'My Workers') }} />
      <Stack.Screen name="worker-detail" options={{ title: t('contractor.workerDetail', 'Worker Details') }} />
      <Stack.Screen name="requests" options={{ title: t('contractor.requests', 'Worker Requests') }} />
      <Stack.Screen name="initiate-transfer" options={{ title: t('contractor.initiateTransfer', 'Initiate Transfer') }} />
      <Stack.Screen name="travels" options={{ title: t('contractor.travels', 'Worker Travels') }} />
      <Stack.Screen name="travel-report-form" options={{ title: t('contractor.travelReport', 'Travel Report') }} />
      <Stack.Screen name="notifications" options={{ title: t('contractor.notifications', 'Notifications') }} />
    </Stack>
  );
}
