import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../lib/auth';
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
  it('shows a validation error for an invalid phone number', async () => {
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('10-digit number'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByPlaceholderText('4–6 digits'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByText(/Phone number must be 10 digits/i)).toBeInTheDocument());
  });

  it('can switch to the staff tab', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Staff' }));
    expect(screen.getByText('Username')).toBeInTheDocument();
  });
});
