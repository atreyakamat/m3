import { Outlet } from 'react-router-dom';
import { AppShell, type NavItem } from '../../components/AppShell';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const nav: NavItem[] = [
  { to: '/admin', label: 'Overview' },
  { to: '/admin/facilities', label: 'Facilities (PHC/UHC)' },
  { to: '/admin/corrections', label: 'Profile Corrections' },
  { to: '/admin/sites', label: 'Construction Sites' },
  { to: '/admin/users', label: 'User Management' },
  { to: '/admin/workers', label: 'Workers' },
  { to: '/admin/requests', label: 'Worker Requests' },
  { to: '/admin/transfers', label: 'Transfers' },
  { to: '/admin/travel-reports', label: 'Travel Reports' },
  { to: '/admin/notifications', label: 'Notifications' },
  { to: '/admin/demo-data', label: 'Demo Data' },
];

interface UnreadCount {
  unread: number;
  items: unknown[];
}

/** Tail badge on the notifications tab, showing the unread inbox size. */
function useUnread(): number {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    api.get<UnreadCount>('/admin/notifications?pageSize=1')
      .then((r) => { if (alive) setUnread(r.unread); })
      .catch(() => undefined);
    const t = setInterval(() => {
      api.get<UnreadCount>('/admin/notifications?pageSize=1')
        .then((r) => { if (alive) setUnread(r.unread); })
        .catch(() => undefined);
    }, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return unread;
}

export function AdminLayout() {
  const unread = useUnread();
  const items = nav.map((n) =>
    n.to === '/admin/notifications' && unread > 0
      ? {
          ...n,
          label: `${n.label} (${unread})`,
        }
      : n,
  );
  return (
    <AppShell role="ADMIN" navItems={items}>
      <Outlet />
    </AppShell>
  );
}
