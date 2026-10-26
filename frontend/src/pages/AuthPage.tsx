import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signIn } from '@/features/auth/auth.client';
import { authFormSchema, type AuthFormValues } from '@/features/auth/auth.schemas';
import { requestError } from '@/lib/http';
import { useAuth } from '@/store/auth';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const creating = mode === 'register';
  const status = useAuth((state) => state.status);
  const location = useLocation();
  const [failure, setFailure] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema(mode)),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });
  const from: unknown = location.state?.from;
  const returnTo =
    typeof from === 'string' && /^\/(?:dashboard|skills|goals|roadmap|plan)(?:[/?#]|$)/.test(from)
      ? from
      : '/dashboard';
  if (status === 'authenticated') return <Navigate to={returnTo} replace />;
  const submit = handleSubmit(async (values) => {
    setFailure('');
    try {
      await signIn(mode, {
        email: values.email,
        password: values.password,
        ...(creating ? { name: values.name } : {}),
      });
    } catch (error) {
      setFailure(requestError(error));
    }
  });
  return (
    <div className="auth-shell">
      <Link to="/" className="brand">
        <span className="brand-mark">
          <ArrowUpRight size={20} />
        </span>
        linkup<span className="brand-period">.</span>
      </Link>
      <main className="auth-card">
        <p className="eyebrow">{creating ? 'YOUR NEXT CHAPTER' : 'ONE STEP AT A TIME'}</p>
        <h1>{creating ? 'Start your journey.' : 'Welcome back.'}</h1>
        <p className="auth-description">
          {creating
            ? 'Create an account and make room for what’s next.'
            : 'Sign in to continue your learning journey.'}
        </p>
        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          aria-label={creating ? 'Create account' : 'Sign in'}
        >
          {failure && (
            <div className="form-error" role="alert">
              {failure}
            </div>
          )}
          {creating && (
            <div className="form-field">
              <label htmlFor="name">Your name</label>
              <input
                id="name"
                autoComplete="name"
                maxLength={100}
                {...register('name')}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <p id="name-error" className="field-error" role="alert">
                  {errors.name.message}
                </p>
              )}
            </div>
          )}
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              {...register('email')}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p id="email-error" className="field-error" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="form-field">
            <label htmlFor="password">Password</label>
            <div className="password-input">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={creating ? 'new-password' : 'current-password'}
                maxLength={72}
                {...register('password')}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? 'password-error' : creating ? 'password-hint' : undefined
                }
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {errors.password ? (
              <p id="password-error" className="field-error" role="alert">
                {errors.password.message}
              </p>
            ) : (
              creating && (
                <p id="password-hint" className="field-hint">
                  At least 8 characters. Choose a password you don’t use elsewhere.
                </p>
              )
            )}
          </div>
          {creating && (
            <div className="form-field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                maxLength={72}
                {...register('confirmPassword')}
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
              />
              {errors.confirmPassword && (
                <p id="confirm-error" className="field-error" role="alert">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          )}
          <Button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? creating
                ? 'Creating your account…'
                : 'Signing in…'
              : creating
                ? 'Create account'
                : 'Sign in'}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Button>
        </form>
        <p className="auth-switch">
          {creating ? 'Already have an account?' : 'New to linkup?'}{' '}
          <Link className="text-link" to={creating ? '/login' : '/register'}>
            {creating ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </main>
      <p className="auth-footer">A small step toward what’s next.</p>
    </div>
  );
}
