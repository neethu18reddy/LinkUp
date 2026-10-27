import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpRight, Eye, EyeOff, Sparkles, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { signIn } from '@/features/auth/auth.client';
import { authFormSchema, type AuthFormValues } from '@/features/auth/auth.schemas';
import { requestError } from '@/lib/http';
import { useAuth } from '@/store/auth';
import { GoogleSignIn } from '@/features/auth/GoogleSignIn';

function getPasswordStrength(pass: string): number {
  if (!pass) return 0;
  let score = 0;
  if (pass.length >= 8) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  return score;
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const creating = mode === 'register';
  const status = useAuth((state) => state.status);
  const location = useLocation();
  const [failure, setFailure] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema(mode)),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const strength = getPasswordStrength(passwordValue);
  const passwordRegister = register('password');

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
    <div className="auth-shell relative overflow-hidden min-h-screen flex flex-col justify-center items-center py-12 px-4">
      {/* Animated glowing background botanical gradient orbs */}
      <motion.div
        className="pointer-events-none absolute -top-32 -right-32 h-[30rem] w-[30rem] rounded-full bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent blur-[120px]"
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.85, 0.6] }}
        transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-24 -left-24 h-[26rem] w-[26rem] rounded-full bg-gradient-to-tr from-emerald-600/15 via-cyan-500/10 to-transparent blur-[110px]"
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.75, 0.5] }}
        transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut', delay: 1 }}
      />

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <Link to="/" className="brand">
          <span className="brand-mark shadow-sm shadow-emerald-700/20">
            <ArrowUpRight size={20} />
          </span>
          linkup<span className="brand-period">.</span>
        </Link>
      </motion.div>

      <motion.main
        className="auth-card relative backdrop-blur-xl bg-white/95 border border-emerald-900/10 shadow-2xl shadow-emerald-950/10 rounded-2xl p-8 max-w-md w-full"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <motion.p
          className="eyebrow flex items-center gap-1.5 text-xs font-semibold text-emerald-700 tracking-wider uppercase mb-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Sparkles size={13} className="text-emerald-600" aria-hidden="true" />
          {creating ? 'YOUR NEXT CHAPTER' : 'ONE STEP AT A TIME'}
        </motion.p>
        <h1 className="text-2xl font-bold text-emerald-950">
          {creating ? 'Start your journey.' : 'Welcome back.'}
        </h1>
        <p className="auth-description text-sm text-gray-500 mb-6">
          {creating
            ? "Create an account and make room for what's next."
            : 'Sign in to continue your learning journey.'}
        </p>

        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          aria-label={creating ? 'Create account' : 'Sign in'}
          className="space-y-4"
        >
          <AnimatePresence mode="wait">
            {failure && (
              <motion.div
                className="form-error p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs"
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
              <label htmlFor="name" className="block text-xs font-semibold text-gray-700 mb-1">
                Your name
              </label>
              <input
                id="name"
                autoComplete="name"
                maxLength={100}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm outline-none transition-all"
                {...register('name')}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <p id="name-error" className="field-error text-xs text-red-600 mt-1" role="alert">
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
            <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm outline-none transition-all"
              {...register('email')}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p id="email-error" className="field-error text-xs text-red-600 mt-1" role="alert">
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
            <label htmlFor="password" className="block text-xs font-semibold text-gray-700 mb-1">
              Password
            </label>
            <div className="password-input relative flex items-center">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={creating ? 'new-password' : 'current-password'}
                maxLength={72}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm outline-none transition-all pr-10"
                {...passwordRegister}
                onChange={(event) => {
                  void passwordRegister.onChange(event);
                  setPasswordValue(event.target.value);
                }}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? 'password-error' : creating ? 'password-hint' : undefined
                }
              />
              <button
                type="button"
                className="password-toggle absolute right-3 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Google Stitch Interactive 4-Tier Password Strength Meter */}
            {creating && passwordValue && (
              <div className="mt-2 space-y-1" aria-hidden="true">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        strength >= level
                          ? strength === 1
                            ? 'bg-amber-400'
                            : strength === 2
                              ? 'bg-amber-500'
                              : strength === 3
                                ? 'bg-emerald-400'
                                : 'bg-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-mono uppercase text-gray-500 pt-0.5">
                  <span>Min. 8 chars</span>
                  <span className="font-semibold text-emerald-700">
                    {strength <= 1
                      ? 'Weak'
                      : strength === 2
                        ? 'Fair'
                        : strength === 3
                          ? 'Good'
                          : 'Strong'}
                  </span>
                </div>
              </div>
            )}

            {errors.password ? (
              <p id="password-error" className="field-error text-xs text-red-600 mt-1" role="alert">
                {errors.password.message}
              </p>
            ) : (
              creating && (
                <p id="password-hint" className="field-hint text-[11px] text-gray-500 mt-1">
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
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                maxLength={72}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm outline-none transition-all"
                {...register('confirmPassword')}
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
              />
              {errors.confirmPassword && (
                <p
                  id="confirm-error"
                  className="field-error text-xs text-red-600 mt-1"
                  role="alert"
                >
                  {errors.confirmPassword.message}
                </p>
              )}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: creating ? 0.4 : 0.3 }}
            className="pt-2"
          >
            <Button
              variant="glow"
              className="auth-submit w-full justify-center py-3 text-sm font-semibold shadow-lg shadow-emerald-500/25"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? creating
                  ? 'Creating your account…'
                  : 'Signing in…'
                : creating
                  ? 'Create account'
                  : 'Sign in'}
              <ArrowUpRight size={16} aria-hidden="true" className="ml-1" />
            </Button>
          </motion.div>
        </form>

        {!creating && (
          <p className="auth-switch text-center mt-4 text-xs">
            <Link
              className="text-link text-emerald-800 hover:text-emerald-950 font-medium"
              to="/forgot-password"
            >
              Forgot your password?
            </Link>
          </p>
        )}

        {location.search.includes('google=existing-account') && (
          <p
            className="form-error p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs mt-4"
            role="alert"
          >
            This email already has a linkup account. Sign in with your password or use password
            recovery.
          </p>
        )}

        {location.search.includes('google=failed') && (
          <p
            className="form-error p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs mt-4"
            role="alert"
          >
            Google sign-in could not be completed. Please try again.
          </p>
        )}

        <div className="mt-4">
          <GoogleSignIn />
        </div>

        <p className="auth-switch text-center text-xs text-gray-500 mt-5 pt-4 border-t border-gray-100">
          {creating ? 'Already have an account?' : 'New to linkup?'}{' '}
          <Link
            className="text-link text-emerald-700 font-semibold hover:text-emerald-900"
            to={creating ? '/login' : '/register'}
          >
            {creating ? 'Sign in' : 'Create an account'}
          </Link>
        </p>

        {/* Security / Honor code ribbon */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
          <ShieldCheck size={13} className="text-emerald-600" />
          <span>Encrypted with 256-bit AES · Privacy First</span>
        </div>
      </motion.main>

      <motion.p
        className="auth-footer text-xs text-gray-400 mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        A small step toward what's next.
      </motion.p>
    </div>
  );
}
