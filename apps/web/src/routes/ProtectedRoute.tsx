import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from '@m3/shared';
import { useAuth } from '../lib/authContext';
import { homeFor } from '../lib/routes';

export function ProtectedRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  // Mandatory first-login credential change must complete before any portal.
  if (user.credentialChangeRequired && user.role !== 'WORKER') {
    return <Navigate to="/first-login" replace />;
  }
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

