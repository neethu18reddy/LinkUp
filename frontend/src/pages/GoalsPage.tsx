import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import {
  customGoalSchema,
  getCurrentGoal,
  getRoles,
  goalKeys,
  saveGoal,
  type GoalInput,
} from '@/features/goals/goals.api';
import { InterestQuiz } from '@/features/goals/InterestQuiz';
import { levelLabels } from '@/features/skills/skills.api';

export function GoalsPage() {
  const client = useQueryClient();
  const roles = useQuery({ queryKey: goalKeys.roles, queryFn: getRoles });
  const current = useQuery({ queryKey: goalKeys.current, queryFn: getCurrentGoal });
  const [mode, setMode] = useState<'direct' | 'quiz'>('direct');
  const [selection, setSelection] = useState('');
  const [custom, setCustom] = useState('');
  const [quizId, setQuizId] = useState<string | undefined>();
  const [review, setReview] = useState<GoalInput | null>(null);
  const [validation, setValidation] = useState('');
  const [feedback, setFeedback] = useState('');
  const save = useMutation({
    mutationFn: saveGoal,
    onSuccess: (goal) => {
      client.setQueryData(goalKeys.current, goal);
      setReview(null);
      setSelection('');
      setCustom('');
      setQuizId(undefined);
      setFeedback(`Your goal is now ${goal.targetRole}.`);
      toast.success('Goal saved');
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.data?.error?.code === 'GOAL_CHANGED') {
        setReview(null);
        void client.invalidateQueries({ queryKey: goalKeys.current });
      }
    },
  });
  const role = roles.data?.find((entry) => entry.id === selection);
  const ready = !current.isPending && !current.isError && !current.isFetching;
  function resetDraft() {
    setReview(null);
    setValidation('');
    setFeedback('');
    save.reset();
  }
  function prepareReview() {
    resetDraft();
    if (!ready) return;
    const expectedGoalId = current.data?.id ?? null;
    if (selection === 'custom') {
      const result = customGoalSchema.safeParse(custom);
      if (!result.success) {
        setValidation(result.error.issues[0]!.message);
        return;
      }
      setReview({ kind: 'CUSTOM', targetRole: result.data, expectedGoalId });
    } else if (role)
      setReview({
        kind: 'ROLE',
        roleId: role.id,
        ...(quizId ? { quizResponseId: quizId } : {}),
        expectedGoalId,
      });
    else setValidation('Choose a role or a custom skill first.');
  }
  return (
    <AccountLayout>
      <main className="dashboard-main goals-page">
        <p className="eyebrow">YOUR NEXT DIRECTION</p>
        <h1>Where do you want to go?</h1>
        <p className="auth-description">
          Pick a role, name a skill, or explore your interests first.{' '}
          <Link className="text-link" to="/skills">
            Review your skills
          </Link>
        </p>
        <section className="skills-card current-goal" aria-labelledby="current-goal-title">
          <h2 id="current-goal-title">Your current goal</h2>
          {current.isPending ? (
            <p role="status">Loading your goal…</p>
          ) : current.isError ? (
            <div className="inline-query-error">
              <p role="alert">{requestError(current.error)}</p>
              <Button variant="outline" onClick={() => void current.refetch()}>
                Retry current goal
              </Button>
            </div>
          ) : current.data ? (
            <>
              <h3>{current.data.targetRole}</h3>
              <p className="field-hint">
                {current.data.source === 'QUIZ'
                  ? 'Chosen from your quiz suggestions'
                  : 'Chosen directly'}{' '}
                · You can change this later.
              </p>
            </>
          ) : (
            <p className="skill-empty">
              No goal yet. Choose the direction you’d like to explore below.
            </p>
          )}
          {feedback && (
            <p className="skill-feedback" role="status">
              {feedback}
            </p>
          )}
        </section>
        {mode === 'quiz' ? (
          <InterestQuiz
            onSkip={() => {
              setMode('direct');
              setSelection('');
              setQuizId(undefined);
              resetDraft();
            }}
            onChoose={(recommendation, id) => {
              setSelection(recommendation.roleId);
              setQuizId(id);
              setMode('direct');
              resetDraft();
            }}
          />
        ) : (
          <section className="skills-card" aria-labelledby="choose-goal-title">
            <div className="skills-section-heading">
              <h2 id="choose-goal-title">Choose a direction</h2>
              <Button
                variant="outline"
                disabled={save.isPending}
                onClick={() => {
                  resetDraft();
                  setMode('quiz');
                }}
              >
                Take interest quiz
              </Button>
            </div>
            <form
              aria-label="Choose your goal"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                prepareReview();
              }}
            >
              {roles.isPending ? (
                <p role="status">Loading roles…</p>
              ) : roles.isError ? (
                <div className="inline-query-error">
                  <p role="alert">{requestError(roles.error)}</p>
                  <Button type="button" variant="outline" onClick={() => void roles.refetch()}>
                    Retry roles
                  </Button>
                </div>
              ) : (
                <>
                  <div className="form-field">
                    <label htmlFor="goal-choice">Target role or skill</label>
                    <select
                      id="goal-choice"
                      value={selection}
                      disabled={save.isPending}
                      onChange={(event) => {
                        setSelection(event.target.value);
                        setQuizId(undefined);
                        resetDraft();
                      }}
                    >
                      <option value="">Choose a direction</option>
                      {roles.data.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.title}
                        </option>
                      ))}
                      <option value="custom">Learn a specific skill</option>
                    </select>
                  </div>
                  {roles.data.length === 0 && (
                    <p className="field-hint">
                      No role templates are available yet. You can still choose a custom skill.
                    </p>
                  )}
                  {selection === 'custom' && (
                    <div className="form-field">
                      <label htmlFor="custom-goal">What would you like to learn?</label>
                      <input
                        id="custom-goal"
                        placeholder="For example, learn Figma"
                        value={custom}
                        maxLength={150}
                        aria-invalid={!!validation}
                        aria-describedby={validation ? 'goal-error' : undefined}
                        disabled={save.isPending}
                        onChange={(event) => {
                          setCustom(event.target.value);
                          resetDraft();
                        }}
                      />
                    </div>
                  )}
                  {role && (
                    <div className="role-preview">
                      <h3>{role.title}</h3>
                      <p>{role.description}</p>
                      <h4>Starting skills for this role</h4>
                      <ul className="role-skills">
                        {role.requirements.map((item) => (
                          <li key={item.skillId}>
                            {item.skill.name}
                            <span>{levelLabels[item.requiredLevel]}</span>
                          </li>
                        ))}
                      </ul>
                      {quizId && (
                        <p className="skill-feedback">Selected from your quiz suggestions.</p>
                      )}
                    </div>
                  )}
                  {validation && (
                    <p id="goal-error" className="field-error" role="alert">
                      {validation}
                    </p>
                  )}
                  {!review && (
                    <Button type="submit" disabled={!ready || save.isPending}>
                      Review goal
                    </Button>
                  )}
                </>
              )}
            </form>
            {review && (
              <section className="goal-review" aria-labelledby="review-title">
                <h3 id="review-title">Confirm your goal</h3>
                <p>{review.kind === 'CUSTOM' ? review.targetRole : role?.title}</p>
                {current.data && (
                  <p className="field-hint">
                    This replaces your current goal, {current.data.targetRole}. Your previous goal
                    and work will be kept.
                  </p>
                )}
                <div className="goal-actions">
                  <Button
                    variant="outline"
                    disabled={save.isPending}
                    onClick={() => setReview(null)}
                  >
                    Keep editing
                  </Button>
                  <Button disabled={save.isPending} onClick={() => save.mutate(review)}>
                    {save.isPending ? 'Saving goal…' : 'Confirm goal'}
                  </Button>
                </div>
              </section>
            )}
            {save.error && (
              <p className="field-error" role="alert">
                {requestError(save.error)}
              </p>
            )}
          </section>
        )}
      </main>
    </AccountLayout>
  );
}
