import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { Role } from '@m3/shared';
import { AppShell } from '../components/AppShell';
import { Card, Spinner, Banner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { roleColors } from '../lib/tokens';

interface DashboardDto {
  role: Role;
  label: string;
  displayName: string;
  implemented: boolean;
  message: string;
}

export function Placeholder() {
  const { user } = useAuth();
  const { data, loading } = useAsync<DashboardDto>(() => api.get('/stakeholders/dashboard'));
  const role = user!.role;

  return (
    <AppShell role={role} navItems={[]}>
      {loading ? (
        <Spinner />
      ) : (
        <Card accent={roleColors[role].base}>
          <h2>{data?.label}</h2>
          <Banner kind="info">{data?.message}</Banner>
          <p className="muted" style={{ marginTop: 12 }}>
            This role's full workflow is not part of this release. No clinical or operational data is shown here.
          </p>
        </Card>
      )}
    </AppShell>
  );
}
