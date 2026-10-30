import { Outlet } from 'react-router-dom';
import { AppShell, type NavItem } from '../../components/AppShell';

const nav: NavItem[] = [
  { to: '/contractor', label: 'Dashboard' },
  { to: '/contractor/sites', label: 'My sites' },
  { to: '/contractor/initiate', label: 'Initiate transfer' },
  { to: '/contractor/approvals', label: 'Approvals' },
];

export function ContractorLayout() {
  return (
    <AppShell role="CONTRACTOR" navItems={nav}>
      <Outlet />
    </AppShell>
  );
}
