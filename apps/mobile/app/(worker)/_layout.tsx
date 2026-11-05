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
        headerShown: false,
        contentStyle: { backgroundColor: palette.bg },
      }}
    >
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="pass" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="screening" />
      <Stack.Screen name="site" />
      <Stack.Screen name="travel" />
      <Stack.Screen name="transfer" />
      <Stack.Screen name="malaria" />
      <Stack.Screen name="prescriptions" />
      <Stack.Screen name="unwell" />
      <Stack.Screen name="followups" />
    </Stack>
  );
}
