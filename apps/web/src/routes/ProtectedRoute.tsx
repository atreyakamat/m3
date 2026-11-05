import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from '@m3/shared';
import { useAuth } from '../lib/authContext';
import { homeFor } from '../lib/routes';

export function ProtectedRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, logout } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  // Central Role Guard: Worker and Contractor accounts are strictly prohibited from all web portal routes
  if (user.role === 'WORKER') {
    logout();
    return (
      <Navigate
        to="/login"
        state={{ error: 'Worker accounts can only access the M3 mobile app.' }}
        replace
      />
    );
  }

  if (user.role === 'CONTRACTOR') {
    logout();
    return (
      <Navigate
        to="/login"
        state={{ error: 'Contractor accounts can only access the M3 mobile app.' }}
        replace
      />
    );
  }

  // Mandatory first-login credential change must complete before any portal.
  if (user.credentialChangeRequired) {
    return <Navigate to="/first-login" replace />;
  }

  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

