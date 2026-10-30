import { Outlet } from 'react-router-dom';
import { AppShell, type NavItem } from '../../components/AppShell';

const nav: NavItem[] = [
  { to: '/worker', label: 'Dashboard' },
  { to: '/worker/screening', label: 'Screening' },
  { to: '/worker/transfer', label: 'Transfer' },
  { to: '/worker/unwell', label: 'Feeling unwell' },
  { to: '/worker/malaria', label: 'Malaria status' },
  { to: '/worker/prescriptions', label: 'Prescriptions' },
  { to: '/worker/followups', label: 'Follow-ups' },
  { to: '/worker/profile', label: 'Profile' },
];

export function WorkerLayout() {
  return (
    <AppShell role="WORKER" navItems={nav}>
      <Outlet />
    </AppShell>
  );
}
