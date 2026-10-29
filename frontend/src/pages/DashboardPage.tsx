import { Link } from 'react-router-dom';
import { Check, Sprout, ArrowRight, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { useAuth } from '@/store/auth';
import { CurrentGoalCard } from '@/features/goals/CurrentGoalCard';
import { DashboardProgress } from '@/features/progress/DashboardProgress';
import { AccountAccessCard } from '@/features/auth/AccountAccessCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FadeIn } from '@/components/ui/animated-container';

export function DashboardPage() {
  const reducedMotion = useReducedMotion();
  const user = useAuth((state) => state.user);
  return (
    <AccountLayout>
      <main className="dashboard-main">
        <FadeIn>
          <PageHeader
            eyebrow="YOUR LEARNING SPACE"
            title={
              <>
                Welcome, <span className="text-[#6750a4]">{user?.name}</span>.
              </>
            }
            description="You've taken the first step. Let's build from here."
          />
        </FadeIn>

        <FadeIn delay={0.1}>
          <DashboardProgress />
        </FadeIn>

        <FadeIn delay={0.2}>
          <motion.details
            className="dashboard-empty"
            whileHover={{ borderColor: '#b8b5ec' }}
            transition={{ duration: 0.2 }}
          >
            <summary className="cursor-pointer">
              <Sparkles size={16} className="inline mr-2 text-[#6750a4]" aria-hidden="true" />
              Review your starting skills
            </summary>
            <span className="empty-icon">
              <motion.div
                animate={reducedMotion ? undefined : { rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              >
                <Sprout size={28} strokeWidth={1.4} />
              </motion.div>
            </span>
            <h2>Start with what you know.</h2>
            <p>
              Add your skills and choose your current level. We'll use this starting point when you
              set a learning goal.
            </p>
            <Button asChild>
              <Link to="/skills">
                Build your skill profile <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
            <p className="account-ready">
              <Check size={14} aria-hidden="true" /> Your account is ready
            </p>
          </motion.details>
        </FadeIn>

        <FadeIn delay={0.3}>
          <CurrentGoalCard />
        </FadeIn>

        <FadeIn delay={0.35}>
          <AccountAccessCard />
        </FadeIn>

        <FadeIn delay={0.4}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Your account</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4">
                <div className="grid grid-cols-[80px_1fr] gap-5 text-xs">
                  <dt className="text-[#6750a4]">Name</dt>
                  <dd className="m-0 font-medium overflow-wrap-anywhere">{user?.name}</dd>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-5 text-xs">
                  <dt className="text-[#6750a4]">Email</dt>
                  <dd className="m-0 font-medium overflow-wrap-anywhere">{user?.email}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </FadeIn>
      </main>
    </AccountLayout>
  );
}
