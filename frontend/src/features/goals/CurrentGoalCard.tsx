import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Compass, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { getCurrentGoal, goalKeys } from './goals.api';
import { Badge } from '@/components/ui/badge';

export function CurrentGoalCard() {
  const goal = useQuery({ queryKey: goalKeys.current, queryFn: getCurrentGoal });
  return (
    <motion.section
      className="skills-card current-goal"
      aria-labelledby="overview-goal-title"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 id="overview-goal-title">Your next direction</h2>
        {goal.data && (
          <Badge variant="default" className="gap-1 font-normal">
            <Target size={11} aria-hidden="true" />
            {goal.data.source === 'QUIZ' ? 'Quiz matched' : 'Active goal'}
          </Badge>
        )}
      </div>
      {goal.isPending ? (
        <p role="status">Loading your goal…</p>
      ) : goal.isError ? (
        <div className="inline-query-error">
          <p role="alert">{requestError(goal.error)}</p>
          <Button variant="outline" onClick={() => void goal.refetch()}>
            Retry goal
          </Button>
        </div>
      ) : goal.data ? (
        <>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#6750a4]/10 text-[#6750a4]">
              <Compass size={18} aria-hidden="true" />
            </span>
            <h3 className="m-0 text-xl font-semibold tracking-tight">{goal.data.targetRole}</h3>
          </div>
          <p className="field-hint">
            Your goal is saved. Review your skill gaps and build a roadmap.
          </p>
          <Link
            className="text-link inline-flex items-center gap-1 font-medium text-sm text-[#6750a4] hover:underline"
            to="/roadmap"
          >
            Open your roadmap <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </>
      ) : (
        <p className="skill-empty">
          Choose a role or explore your interests to find your next step.
        </p>
      )}
      <div className="mt-3">
        <Button asChild variant="outline">
          <Link to="/goals" className="inline-flex items-center gap-2">
            {goal.data ? 'Review your goal' : 'Choose your goal'}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </motion.section>
  );
}
