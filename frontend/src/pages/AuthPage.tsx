import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { signIn } from '@/features/auth/auth.client';
import { authFormSchema, type AuthFormValues } from '@/features/auth/auth.schemas';
import { requestError } from '@/lib/http';
import { useAuth } from '@/store/auth';
import { GoogleSignIn } from '@/features/auth/GoogleSignIn';

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
    typeof from === 'string' &&
    /^\/(?:dashboard|skills|goals|roadmap|plan|progress|mentor|certificates|notifications)(?:[/?#]|$)/.test(
      from,
    )
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
    <div className="auth-shell relative overflow-hidden">
      {/* Animated background gradient orbs */}
      <motion.div
        className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gradient-to-br from-[#225c47]/10 to-[#438b65]/5 blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.7, 0.5] }}
        transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-gradient-to-tr from-[#438b65]/8 to-[#7bc49a]/5 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut', delay: 1 }}
      />

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Link to="/" className="brand">
          <span className="brand-mark">
            <ArrowUpRight size={20} />
          </span>
          linkup<span className="brand-period">.</span>
        </Link>
      </motion.div>

      <motion.main
        className="auth-card relative"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <motion.p
          className="eyebrow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Sparkles size={12} className="inline mr-1 text-[#438b65]" aria-hidden="true" />
          {creating ? 'YOUR NEXT CHAPTER' : 'ONE STEP AT A TIME'}
        </motion.p>
        <h1>{creating ? 'Start your journey.' : 'Welcome back.'}</h1>
        <p className="auth-description">
          {creating
            ? "Create an account and make room for what's next."
            : 'Sign in to continue your learning journey.'}
        </p>
        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          aria-label={creating ? 'Create account' : 'Sign in'}
        >
          <AnimatePresence mode="wait">
            {failure && (
              <motion.div
                className="form-error"
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                {failure}
              </motion.div>
            )}
          </AnimatePresence>
          {creating && (
            <motion.div
              className="form-field"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
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
            </motion.div>
          )}
          <motion.div
            className="form-field"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: creating ? 0.25 : 0.2 }}
          >
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
          </motion.div>
          <motion.div
            className="form-field"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: creating ? 0.3 : 0.25 }}
          >
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
                  At least 8 characters. Choose a password you don't use elsewhere.
                </p>
              )
            )}
          </motion.div>
          {creating && (
            <motion.div
              className="form-field"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
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
            </motion.div>
          )}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: creating ? 0.4 : 0.3 }}
          >
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
          </motion.div>
        </form>
        {!creating && (
          <p className="auth-switch">
            <Link className="text-link" to="/forgot-password">
              Forgot your password?
            </Link>
          </p>
        )}
        {location.search.includes('google=existing-account') && (
          <p className="form-error" role="alert">
            This email already has a linkup account. Sign in with your password or use password
            recovery.
          </p>
        )}
        {location.search.includes('google=failed') && (
          <p className="form-error" role="alert">
            Google sign-in could not be completed. Please try again.
          </p>
        )}
        <GoogleSignIn />
        <p className="auth-switch">
          {creating ? 'Already have an account?' : 'New to linkup?'}{' '}
          <Link className="text-link" to={creating ? '/login' : '/register'}>
            {creating ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </motion.main>
      <motion.p
        className="auth-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        A small step toward what's next.
      </motion.p>
    </div>
  );
}
