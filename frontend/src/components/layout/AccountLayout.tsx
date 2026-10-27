import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowUpRight,
  LogOut,
  LayoutDashboard,
  Layers,
  Target,
  Route,
  CalendarDays,
  BookOpen,
  MessageCircle,
  Award,
  Bell,
} from 'lucide-react';
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
    <div className="workspace-shell">
      <header className="site-header account-header">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <ArrowUpRight size={20} />
          </span>
          linkup<span className="brand-period">.</span>
        </Link>
        <nav aria-label="Your workspace">
          <p className="nav-label">WORKSPACE</p>
          {(
            [
              ['/dashboard', 'Overview', LayoutDashboard],
              ['/skills', 'My skills', Layers],
              ['/goals', 'My goals', Target],
              ['/roadmap', 'Roadmap', Route],
              ['/plan', 'Weekly plan', CalendarDays],
              ['/progress', 'Learning logs', BookOpen],
              ['/mentor', 'Mentor', MessageCircle],
              ['/certificates', 'Certificates', Award],
              ['/notifications', 'Notifications', Bell],
            ] as const
          ).map(([path, label, Icon]) => {
            return (
              <NavLink key={path} to={path}>
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span className="sidebar-note-icon">↗</span>
          <strong>Small steps. Real progress.</strong>
          <p>Your next chapter starts with a little time each week.</p>
        </div>
        <Button variant="outline" onClick={() => void logout()} disabled={pending}>
          <LogOut size={15} aria-hidden="true" />
          {pending ? 'Signing out…' : 'Sign out'}
        </Button>
      </header>
      <div className="workspace-content">
        <div className="workspace-topbar">
          <span>Your learning workspace</span>
          <span className="workspace-status">
            <span />
            Learning, at your pace
          </span>
        </div>
        {failure && (
          <p className="form-error" role="alert">
            {failure}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
