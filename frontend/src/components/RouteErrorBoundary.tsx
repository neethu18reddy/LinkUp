import { Component, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/auth';
class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="session-screen">
        <div className="skills-card" role="alert">
          <h1>We couldn’t load this page.</h1>
          <p>Try reloading. If the problem continues, return home and open the page again.</p>
          <Button onClick={() => window.location.reload()}>Reload page</Button>{' '}
          <Link to="/">Return home</Link>
        </div>
      </main>
    );
  }
}
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const account = useAuth((state) => state.user?.id ?? 'public');
  return <PageBoundary key={`${account}:${pathname}`}>{children}</PageBoundary>;
}
