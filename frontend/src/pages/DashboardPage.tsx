import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, LogOut, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/auth';
import { signOut } from '@/features/auth/auth.client';
import { requestError } from '@/lib/http';

export function DashboardPage() {
  const user = useAuth((state) => state.user);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  async function logout() {
    setPending(true);
    setFailure('');
    try {
      await signOut();
    } catch (error) {
      setFailure(requestError(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="site-shell dashboard-shell">
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <ArrowUpRight size={20} />
          </span>
          linkup<span className="brand-period">.</span>
        </Link>
        <Button variant="outline" onClick={() => void logout()} disabled={pending}>
          <LogOut size={15} aria-hidden="true" />
          {pending ? 'Signing out…' : 'Sign out'}
        </Button>
      </header>
      <main className="dashboard-main">
        {failure && (
          <p className="form-error" role="alert">
            {failure}
          </p>
        )}
        <p className="eyebrow">YOUR LEARNING SPACE</p>
        <h1>Welcome, {user?.name}.</h1>
        <p className="auth-description">You’ve taken the first step. Let’s build from here.</p>
        <section className="dashboard-empty">
          <span className="empty-icon">
            <Sprout size={28} strokeWidth={1.4} />
          </span>
          <h2>A fresh start.</h2>
          <p>
            Your learning path will live here. Skill profiles and goal selection are coming in the
            next phases.
          </p>
          <span className="account-ready">
            <Check size={14} aria-hidden="true" /> Your account is ready
          </span>
        </section>
        <section className="account-summary" aria-labelledby="account-title">
          <h2 id="account-title">Your account</h2>
          <dl>
            <div>
              <dt>Name</dt>
              <dd>{user?.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email}</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}
