import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signIn } from '@/features/auth/auth.client';
import { useAuth } from '@/store/auth';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AuthPage } from './AuthPage';

vi.mock('@/features/auth/auth.client', () => ({ signIn: vi.fn(), refreshSession: vi.fn() }));
const user = {
  id: 'c08b8c88-e1a7-4ee9-9760-f2ade72183dc',
  name: 'Learner',
  email: 'learner@example.test',
  role: 'USER' as const,
  createdAt: new Date().toISOString(),
};
beforeEach(() => {
  useAuth.getState().clearSession();
  vi.clearAllMocks();
});

function renderForm(mode: 'login' | 'register') {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<AuthPage mode={mode} />} />
        <Route path="/dashboard" element={<h1>Your learning space</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('authentication forms', () => {
  it('validates registration before making a request', async () => {
    renderForm('register');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('rejects mismatching confirmation', async () => {
    renderForm('register');
    await userEvent.type(screen.getByLabelText('Your name'), 'Learner');
    await userEvent.type(screen.getByLabelText('Email'), user.email);
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Learning!42');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Different!42');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('shows a network error and allows another submission', async () => {
    vi.mocked(signIn).mockRejectedValue(new AxiosError('Offline', 'ERR_NETWORK'));
    renderForm('login');
    await userEvent.type(screen.getByLabelText('Email'), user.email);
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Learning!42');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t reach the server');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('shows pending state and redirects after a successful sign-in', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof signIn>>) => void;
    vi.mocked(signIn).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    renderForm('login');
    await userEvent.type(screen.getByLabelText('Email'), user.email);
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Learning!42');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    // Simulate the auth client committing the successful session.
    const { act } = await import('@testing-library/react');
    await act(async () => {
      useAuth.getState().setSession(user, 'memory-only-token');
      resolve({ user, accessToken: 'memory-only-token', expiresIn: 900 });
    });
    expect(await screen.findByRole('heading', { name: 'Your learning space' })).toBeInTheDocument();
  });
});

describe('protected routes', () => {
  function renderGuard() {
    return render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<h1>Private dashboard</h1>} />
          </Route>
          <Route path="/login" element={<h1>Sign in first</h1>} />
        </Routes>
      </MemoryRouter>,
    );
  }
  it('redirects anonymous visitors', () => {
    renderGuard();
    expect(screen.getByText('Sign in first')).toBeInTheDocument();
  });
  it('waits for session restoration', () => {
    useAuth.setState({ status: 'loading' });
    renderGuard();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
  });
  it('shows retry after a session network failure', () => {
    useAuth.getState().setError('Unable to connect.');
    renderGuard();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to connect');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
  it('renders only for an authenticated session', () => {
    useAuth.getState().setSession(user, 'token');
    renderGuard();
    expect(screen.getByText('Private dashboard')).toBeInTheDocument();
  });
});
