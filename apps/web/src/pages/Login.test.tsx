import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../lib/auth';
import { load, STORAGE_KEY } from '../lib/authContext';
import { Login } from './Login';

function renderLogin() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders staff login fields and no worker or contractor tabs or registration options', () => {
    renderLogin();
    expect(screen.getByText('Staff Sign In')).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();

    // Verify worker and contractor tabs and registration links are NOT present
    expect(screen.queryByRole('button', { name: 'Worker' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Contractor' })).toBeNull();
    expect(screen.queryByText(/Register/i)).toBeNull();
    expect(screen.queryByText(/New worker/i)).toBeNull();
  });

  it('shows a validation error for empty credentials', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => {
      expect(screen.getByText(/at least 3 character/i)).toBeInTheDocument();
    });
  });

  it('displays the error banner when redirected with Worker error in route state', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { error: 'Worker accounts can only access the M3 mobile app.' } }]}>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Worker accounts can only access the M3 mobile app.')).toBeInTheDocument();
  });

  it('displays the error banner when redirected with Contractor error in route state', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { error: 'Contractor accounts can only access the M3 mobile app.' } }]}>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Contractor accounts can only access the M3 mobile app.')).toBeInTheDocument();
  });

  it('purges existing worker session on load', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: 'fake-worker-jwt',
        user: { userId: 'u-1', role: 'WORKER', workerId: 'W100', displayName: 'Worker' },
      }),
    );
    const result = load();
    expect(result).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('purges existing contractor session on load', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: 'fake-contractor-jwt',
        user: { userId: 'u-2', role: 'CONTRACTOR', contractorId: 'C100', displayName: 'Contractor' },
      }),
    );
    const result = load();
    expect(result).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
