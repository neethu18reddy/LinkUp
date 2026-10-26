import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { getCurrentGoal, goalKeys } from './goals.api';

export function CurrentGoalCard() {
  const goal = useQuery({ queryKey: goalKeys.current, queryFn: getCurrentGoal });
  return (
    <section className="skills-card current-goal" aria-labelledby="overview-goal-title">
      <h2 id="overview-goal-title">Your next direction</h2>
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
          <h3>{goal.data.targetRole}</h3>
          <p className="field-hint">
            Your goal is saved. Review your skill gaps and build a roadmap.
          </p>
          <Link className="text-link" to="/roadmap">
            Open your roadmap
          </Link>
        </>
      ) : (
        <p className="skill-empty">
          Choose a role or explore your interests to find your next step.
        </p>
      )}
      <Button asChild variant="outline">
        <Link to="/goals">{goal.data ? 'Review your goal' : 'Choose your goal'}</Link>
      </Button>
    </section>
  );
}
