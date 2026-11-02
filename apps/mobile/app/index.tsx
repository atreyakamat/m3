import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '@/store/session';

/** Entry router: send returning signed-in workers to the dashboard, everyone
 *  else to language selection → sign-in. */
export default function Index() {
  const { ready, token, user } = useSession();
  if (!ready) return null;
  if (token) {
    if (user?.credentialChangeRequired) return <Redirect href="/first-login" />;
    if (user?.role === 'CONTRACTOR') return <Redirect href="/(contractor)/dashboard" />;
    return <Redirect href="/(worker)/dashboard" />;
  }
  return <Redirect href="/language" />;
}
