import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { LearningSteps } from '@/components/layout/LearningSteps';
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
import { ArrowRight, Plus, Search, Target, Check } from 'lucide-react';

function roleCategory(title: string) {
  if (/data|analyst|scientist|\bBI\b/i.test(title)) return 'Data';
  if (/design|research/i.test(title)) return 'Design';
  if (/devops|platform|linux/i.test(title)) return 'Infrastructure';
  if (/QA|test automation|accessibility/i.test(title)) return 'Quality';
  return 'Development';
}

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
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const save = useMutation({
    mutationFn: saveGoal,
    onSuccess: (goal) => {
      void client.invalidateQueries({ queryKey: ['current-roadmap'] });
      void client.invalidateQueries({ queryKey: ['progress-summary'] });
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
        <LearningSteps />
        <p className="eyebrow">YOUR NEXT DIRECTION</p>
        <h1>Where do you want to go?</h1>
        <p className="auth-description">
          Find your next challenge. Choose a career path or create a goal of your own.{' '}
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
          {current.data && (
            <Link className="goal-next" to="/roadmap">
              Continue to your roadmap <ArrowRight size={17} aria-hidden="true" />
            </Link>
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
            <div className="custom-goal-callout">
              <span className="goal-callout-icon">
                <Target size={22} aria-hidden="true" />
              </span>
              <div>
                <h3>A goal that’s uniquely yours</h3>
                <p>Have something else in mind? Add any skill, role or personal learning goal.</p>
              </div>
              <Button
                variant={selection === 'custom' ? 'default' : 'outline'}
                disabled={save.isPending}
                onClick={() => {
                  setSelection('custom');
                  setQuizId(undefined);
                  resetDraft();
                }}
              >
                <Plus size={16} aria-hidden="true" /> Add custom goal
              </Button>
            </div>
            {selection === 'custom' && (
              <div className="form-field custom-goal-field">
                <label htmlFor="custom-goal">What would you like to learn?</label>
                <input
                  id="custom-goal"
                  placeholder="For example, learn photography or become a product manager"
                  value={custom}
                  maxLength={150}
                  aria-invalid={!!validation}
                  aria-describedby="custom-goal-hint"
                  disabled={save.isPending}
                  onChange={(event) => {
                    setCustom(event.target.value);
                    resetDraft();
                  }}
                />
                <p id="custom-goal-hint" className="field-hint">
                  Any goal is welcome. Catalogue matches use skill-based roadmaps; other goals get
                  an adaptable starter plan.
                </p>
                <Button disabled={!ready || save.isPending} onClick={prepareReview}>
                  Review custom goal <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </div>
            )}
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
                  <div className="goal-search">
                    <Search size={18} aria-hidden="true" />
                    <input
                      aria-label="Search goals"
                      placeholder="Search careers, skills or interests…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div className="goal-filters" aria-label="Goal categories">
                    {['All', 'Development', 'Data', 'Design', 'Infrastructure', 'Quality'].map(
                      (value) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={category === value}
                          onClick={() => setCategory(value)}
                        >
                          {value}
                        </button>
                      ),
                    )}
                  </div>
                  <p className="goal-results">{roles.data.length} career paths to explore</p>
                  <div className="goal-grid">
                    {roles.data
                      .filter(
                        (entry) =>
                          (category === 'All' || roleCategory(entry.title) === category) &&
                          `${entry.title} ${entry.description} ${entry.requirements.map((item) => item.skill.name).join(' ')}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className={`goal-option ${selection === entry.id ? 'selected' : ''}`}
                          aria-pressed={selection === entry.id}
                          disabled={save.isPending}
                          onClick={() => {
                            setSelection(entry.id);
                            setQuizId(undefined);
                            resetDraft();
                          }}
                        >
                          <span className="goal-option-top">
                            <span className="goal-category">{roleCategory(entry.title)}</span>
                            {selection === entry.id ? (
                              <Check size={18} aria-hidden="true" />
                            ) : (
                              <ArrowRight size={18} aria-hidden="true" />
                            )}
                          </span>
                          <strong>{entry.title}</strong>
                          <span className="goal-option-description">{entry.description}</span>
                          <span className="goal-skill-count">
                            {entry.requirements.length} core skills · Guided roadmap
                          </span>
                        </button>
                      ))}
                  </div>
                  {!roles.data.some(
                    (entry) =>
                      (category === 'All' || roleCategory(entry.title) === category) &&
                      `${entry.title} ${entry.description} ${entry.requirements.map((item) => item.skill.name).join(' ')}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  ) && (
                    <p className="skill-empty">
                      No matching paths. Try another search or add a custom goal above.
                    </p>
                  )}
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
                      <option value="custom">Add a custom goal</option>
                    </select>
                  </div>
                  {roles.data.length === 0 && (
                    <p className="field-hint">
                      No role templates are available yet. You can still choose a custom skill.
                    </p>
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
