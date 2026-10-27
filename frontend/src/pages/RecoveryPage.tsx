import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { recoverAccount } from '@/features/auth/account.api';
import { clearLocalSession } from '@/features/auth/auth.client';

export function RecoveryPage({ mode }: { mode: 'forgot' | 'reset' | 'verify' }) {
  const location = useLocation();
  const client = useQueryClient();
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') ?? '');
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (location.hash) window.history.replaceState(window.history.state, '', location.pathname);
  }, [location.hash, location.pathname]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (
      mode === 'reset' &&
      (password !== confirm ||
        password.length < 8 ||
        new TextEncoder().encode(password).length > 72)
    ) {
      setError('Use 8–72 bytes and enter the same password twice.');
      return;
    }
    setPending(true);
    try {
      setMessage(
        await recoverAccount(
          mode,
          mode === 'forgot' ? { email } : mode === 'reset' ? { token, password } : { token },
        ),
      );
      if (mode === 'reset') {
        clearLocalSession();
        client.clear();
        setPassword('');
        setConfirm('');
      }
      if (mode === 'verify') await client.invalidateQueries({ queryKey: ['account-status'] });
    } catch (failure) {
      setError(requestError(failure));
    } finally {
      setPending(false);
    }
  }
  const valid = mode === 'forgot' || /^[a-f0-9]{64}$/.test(token);
  return (
    <div className="auth-shell">
      <Link className="brand" to="/">
        linkup<span className="brand-period">.</span>
      </Link>
      <main className="auth-card">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>
          {mode === 'forgot'
            ? 'Forgot your password?'
            : mode === 'reset'
              ? 'Choose a new password.'
              : 'Verify your email.'}
        </h1>
        <p className="auth-description">
          {mode === 'forgot'
            ? 'Enter your account email. We’ll send a private reset link if an account exists.'
            : mode === 'reset'
              ? 'After resetting, sign in again on all your devices.'
              : 'Confirm that you own this email address. This does not publish your email.'}
        </p>
        {!valid ? (
          <p role="alert" className="form-error">
            This link is incomplete. Request a new email.
          </p>
        ) : message ? (
          <p role="status">{message}</p>
        ) : (
          <form onSubmit={(event) => void submit(event)}>
            {mode === 'forgot' && (
              <div className="form-field">
                <label htmlFor="recovery-email">Account email</label>
                <input
                  id="recovery-email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            )}
            {mode === 'reset' && (
              <>
                <div className="form-field">
                  <label htmlFor="recovery-password">New password</label>
                  <input
                    id="recovery-password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="recovery-confirm">Confirm new password</label>
                  <input
                    id="recovery-confirm"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                  />
                </div>
              </>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending
                ? 'Working…'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : mode === 'reset'
                    ? 'Reset password'
                    : 'Verify email'}
            </Button>
          </form>
        )}
        <p className="auth-switch">
          <Link className="text-link" to="/login">
            Back to sign in
          </Link>
          {mode === 'reset' && !valid && (
            <>
              {' '}
              ·{' '}
              <Link className="text-link" to="/forgot-password">
                Request a new reset link
              </Link>
            </>
          )}
        </p>
        {mode === 'verify' && (
          <p className="auth-switch">
            <Link className="text-link" to="/dashboard">
              Open your workspace to request a new verification email
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
