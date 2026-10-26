import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowUpRight, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from '@/features/auth/auth.client';
import { requestError } from '@/lib/http';

export function AccountLayout({ children }: { children: ReactNode }) {
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
      <header className="site-header account-header">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <ArrowUpRight size={20} />
          </span>
          linkup<span className="brand-period">.</span>
        </Link>
        <nav aria-label="Your workspace">
          <NavLink to="/dashboard">Overview</NavLink>
          <NavLink to="/skills">My skills</NavLink>
          <NavLink to="/goals">My goal</NavLink>
          <NavLink to="/roadmap">Roadmap</NavLink>
          <NavLink to="/plan">Weekly plan</NavLink>
          <NavLink to="/progress">Learning logs</NavLink>
          <NavLink to="/mentor">Mentor</NavLink>
          <NavLink to="/certificates">Certificates</NavLink>
        </nav>
        <Button variant="outline" onClick={() => void logout()} disabled={pending}>
          <LogOut size={15} aria-hidden="true" />
          {pending ? 'Signing out…' : 'Sign out'}
        </Button>
      </header>
      {failure && (
        <p className="form-error" role="alert">
          {failure}
        </p>
      )}
      {children}
    </div>
  );
}
