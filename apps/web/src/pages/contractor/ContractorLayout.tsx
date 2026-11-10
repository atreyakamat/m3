import { Outlet } from 'react-router-dom';
import { AppShell, type NavItem } from '../../components/AppShell';

const nav: NavItem[] = [
  { to: '/contractor', label: 'Dashboard' },
  { to: '/contractor/sites', label: 'My Sites' },
  { to: '/contractor/workers', label: 'Worker Management' },
  { to: '/contractor/approvals', label: 'Transfer Approvals' },
  { to: '/contractor/initiate', label: 'Initiate Transfer' },
];

export function ContractorLayout() {
  return (
    <AppShell role="CONTRACTOR" navItems={nav}>
      <Outlet />
    </AppShell>
  );
}
