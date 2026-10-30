import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '@/store/session';

/** Entry router: send returning signed-in workers to the dashboard, everyone
 *  else to language selection → sign-in. */
export default function Index() {
  const { ready, token } = useSession();
  if (!ready) return null;
  if (token) return <Redirect href="/(worker)/dashboard" />;
  return <Redirect href="/language" />;
}
