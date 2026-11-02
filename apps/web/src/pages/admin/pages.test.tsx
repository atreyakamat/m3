import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    put: vi.fn(),
    baseUrl: 'http://localhost:8003/api/v1',
  },
}));

const changeCredential = vi.fn(async () => ({ role: 'ADMIN' as const }));
let mockUser: { role: string; displayName: string; credentialChangeRequired?: boolean } | null = null;

vi.mock('../../lib/authContext', () => ({
  useAuth: () => ({
    user: mockUser as never,
    changeCredential: (...a: unknown[]) => changeCredential(...(a as [])),
    logout: () => undefined,
  }),
}));

import { SitesList } from './SitesList';
import { FirstLogin } from '../FirstLogin';

function wrap(ui: ReactNode) {
  return <MemoryRouter initialEntries={['/admin/sites']}>{ui}</MemoryRouter>;
}

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  changeCredential.mockClear();
  mockUser = { role: 'ADMIN', displayName: 'Admin' };
});

afterEach(() => {
  cleanup();
});

describe('Admin pages (web)', () => {
  it('renders the construction-site list from the API', async () => {
    apiGet.mockImplementation((path: string) => {
      if (path.startsWith('/admin/sites')) {
        return Promise.resolve({
          items: [
            { siteId: 'SITE-A', name: 'Alpha Tower', district: 'North Goa', area: 'Candolim', contractor: { contractorId: 'c1', name: 'North Builders' }, activeWorkers: 4, active: true },
          ],
          total: 1, page: 1, pageSize: 20, totalPages: 1,
        });
      }
      return Promise.reject(new Error(`unmocked ${path}`));
    });
    render(wrap(<SitesList />));
    await waitFor(() => expect(screen.getByText('Alpha Tower')).toBeTruthy());
    expect(screen.getByText('SITE-A')).toBeTruthy();
    expect(screen.getByText('North Builders')).toBeTruthy();
    expect(screen.getByText('Create site')).toBeTruthy();
  });

  it('shows the empty state when no sites exist', async () => {
    apiGet.mockImplementation(() => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }));
    render(wrap(<SitesList />));
    await waitFor(() => expect(screen.getByText('Nothing here yet')).toBeTruthy());
    expect(screen.getByText('Create the first construction site to get started.')).toBeTruthy();
  });

  it('shows the error state when the API fails', async () => {
    apiGet.mockImplementation(() => Promise.reject(new Error('Network down')));
    render(wrap(<SitesList />));
    await waitFor(() => expect(screen.getByText('Network down')).toBeTruthy());
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('first-login flow enforces admin password strength and confirmation', async () => {
    render(
      <MemoryRouter initialEntries={['/first-login']}>
        <FirstLogin />
      </MemoryRouter>,
    );
    expect(screen.getByText('First-time setup')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'weak' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'weak' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText('Password must be at least 8 characters')).toBeTruthy();
    expect(changeCredential).not.toHaveBeenCalled();
  });

  it('first-login flow submits a matching strong password', async () => {
    render(
      <MemoryRouter initialEntries={['/first-login']}>
        <FirstLogin />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewStrong1' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewStrong1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(changeCredential).toHaveBeenCalledWith('NewStrong1', 'NewStrong1'));
  });
});
