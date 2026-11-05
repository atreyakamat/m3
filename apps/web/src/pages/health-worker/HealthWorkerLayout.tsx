import { Outlet } from 'react-router-dom';
import { AppShell, type NavItem } from '../../components/AppShell';

const nav: NavItem[] = [
  { to: '/health-worker', label: 'Overview' },
  { to: '/health-worker/search', label: 'Worker Search' },
  { to: '/health-worker/screening', label: 'Assisted Screening' },
  { to: '/health-worker/cases', label: 'Suspected Cases & Tests' },
  { to: '/health-worker/follow-ups', label: 'Follow-ups' },
  { to: '/health-worker/travel-arrivals', label: 'Travel Arrivals' },
  { to: '/health-worker/inbox', label: 'Facility Inbox' },
];

export function HealthWorkerLayout() {
  return (
    <AppShell role="HEALTH_WORKER" navItems={nav}>
      <Outlet />
    </AppShell>
  );
}
