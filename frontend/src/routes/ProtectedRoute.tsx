import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { refreshSession } from '@/features/auth/auth.client';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/ui/button';

export function ProtectedRoute() {
  const { status, error } = useAuth();
  const location = useLocation();
  if (status === 'loading')
    return (
      <main className="session-screen" role="status">
        Checking your session…
      </main>
    );
  if (status === 'error')
    return (
      <main className="session-screen">
        <h1>Let’s reconnect.</h1>
        <p role="alert">{error}</p>
        <Button
          onClick={() => {
            useAuth.setState({ status: 'loading', error: null });
            void refreshSession().catch(() => {});
          }}
        >
          Try again
        </Button>
      </main>
    );
  if (status !== 'authenticated')
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  return <Outlet />;
}
