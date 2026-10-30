import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from '@m3/shared';
import { useAuth } from '../lib/auth';

export function ProtectedRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

export function homeFor(role: Role): string {
  if (role === 'WORKER') return '/worker';
  if (role === 'CONTRACTOR') return '/contractor';
  return '/portal';
}
