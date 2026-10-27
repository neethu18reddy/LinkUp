import { Link } from 'react-router-dom';
import { Check, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { useAuth } from '@/store/auth';
import { CurrentGoalCard } from '@/features/goals/CurrentGoalCard';
import { DashboardProgress } from '@/features/progress/DashboardProgress';
import { AccountAccessCard } from '@/features/auth/AccountAccessCard';
import { PageHeader } from '@/components/layout/PageHeader';

export function DashboardPage() {
  const user = useAuth((state) => state.user);
  return (
    <AccountLayout>
      <main className="dashboard-main">
        <PageHeader
          eyebrow="YOUR LEARNING SPACE"
          title={<>Welcome, {user?.name}.</>}
          description="You’ve taken the first step. Let’s build from here."
        />
        <DashboardProgress />
        <details className="dashboard-empty">
          <summary>Review your starting skills</summary>
          <span className="empty-icon">
            <Sprout size={28} strokeWidth={1.4} />
          </span>
          <h2>Start with what you know.</h2>
          <p>
            Add your skills and choose your current level. We’ll use this starting point when you
            set a learning goal.
          </p>
          <Button asChild>
            <Link to="/skills">Build your skill profile</Link>
          </Button>
          <p className="account-ready">
            <Check size={14} aria-hidden="true" /> Your account is ready
          </p>
        </details>
        <CurrentGoalCard />
        <AccountAccessCard />
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
    </AccountLayout>
  );
}
