import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { Role } from '@m3/shared';
import { ROLE_LABELS } from '@m3/shared';
import { roleColors, roleGradient } from '../lib/tokens';
import { useAuth } from '../lib/auth';

export interface NavItem {
  to: string;
  label: string;
}

export function AppShell({
  role,
  navItems,
  children,
}: {
  role: Role;
  navItems: NavItem[];
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const rc = roleColors[role];

  return (
    <div className="app-main">
      <header style={{ background: roleGradient(role), color: '#fff' }}>
        <div className="container" style={{ padding: '16px var(--gutter)' }}>
          <div className="spread">
            <div>
              <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 600 }}>M3 Malaria Surveillance</div>
              <h1 style={{ margin: 0, fontSize: 22 }}>{ROLE_LABELS[role]}</h1>
            </div>
            <div className="row">
              <span style={{ fontSize: 14, opacity: 0.95 }}>{user?.displayName}</span>
              <button
                onClick={logout}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontWeight: 600,
                }}
              >
                Sign out
              </button>
            </div>
          </div>
          {navItems.length > 0 && (
            <nav className="nav-tabs" style={{ marginTop: 14 }}>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
                  style={({ isActive }) =>
                    isActive ? { background: '#fff', color: rc.base } : { background: 'rgba(255,255,255,0.14)', color: '#fff', borderColor: 'transparent' }
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main className="container page">{children}</main>
    </div>
  );
}
