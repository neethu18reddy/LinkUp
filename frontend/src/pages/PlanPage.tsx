import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { TaskControl } from '@/features/progress/TaskControl';
import type { TaskStatus } from '@/features/progress/progress.api';
import { getCurrentRoadmap, roadmapKey } from '@/features/roadmap/roadmap.api';
import {
  getCurrentPlan,
  previewPlan,
  savePlan,
  planKey,
  modeSchema,
  type Plan,
  type PlanInput,
} from '@/features/plan/plan.api';

function PlanEditor({
  roadmapId,
  plan,
  onSaved,
}: {
  roadmapId: string;
  plan: Plan | null;
  onSaved: () => void;
}) {
  const client = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [hours, setHours] = useState(String(plan?.hoursPerWeek ?? 5));
  const [mode, setMode] = useState<PlanInput['flexibilityMode']>(
    plan?.flexibilityMode ?? 'STANDARD',
  );
  const [start, setStart] = useState(today);
  const [deadline, setDeadline] = useState(plan?.targetEndDate ?? '');
  const preview = useMutation({ mutationFn: previewPlan });
  const save = useMutation({
    mutationFn: savePlan,
    onSuccess: (result) => {
      client.setQueryData(planKey(roadmapId), result);
      onSaved();
    },
    onError: () => {
      preview.reset();
      void client.invalidateQueries({ queryKey: planKey(roadmapId) });
    },
  });
  const pending = preview.isPending || save.isPending;
  function submit(event: FormEvent) {
    event.preventDefault();
    save.reset();
    preview.mutate({
      roadmapId,
      hoursPerWeek: Number(hours),
      flexibilityMode: mode,
      startDate: start,
      targetEndDate: deadline || null,
      expectedPlanId: plan?.id ?? null,
    });
  }
  function changed() {
    preview.reset();
    save.reset();
  }
  return (
    <section className="skills-card">
      <h2>{plan ? 'Adjust your plan' : 'Set your weekly pace'}</h2>
      <p>Scheduling works offline. Weeks start on your chosen date; dates use UTC.</p>
      <form onSubmit={submit}>
        <fieldset disabled={pending} className="plan-fields">
          <div className="form-field">
            <label htmlFor="weekly-hours">Hours per week</label>
            <input
              id="weekly-hours"
              type="number"
              min="0.5"
              max="60"
              step="0.5"
              required
              value={hours}
              onChange={(event) => {
                setHours(event.target.value);
                changed();
              }}
            />
          </div>
          <div className="form-field">
            <label htmlFor="plan-mode">Flexibility</label>
            <select
              id="plan-mode"
              value={mode}
              onChange={(event) => {
                setMode(modeSchema.parse(event.target.value));
                changed();
              }}
            >
              <option value="RELAXED">Relaxed — 80% pace, buffer after four study weeks</option>
              <option value="STANDARD">Standard — your stated hours</option>
              <option value="INTENSIVE">Intensive — 120% pace</option>
              <option value="DEADLINE">Deadline — calculate required hours</option>
            </select>
          </div>
          {!plan && (
            <div className="form-field">
              <label htmlFor="plan-start">Start date</label>
              <input
                id="plan-start"
                type="date"
                min={today}
                required
                value={start}
                onChange={(event) => {
                  setStart(event.target.value);
                  changed();
                }}
              />
            </div>
          )}
          <div className="form-field">
            <label htmlFor="plan-deadline">
              {mode === 'DEADLINE' ? 'Deadline' : 'Target date (optional)'}
            </label>
            <input
              id="plan-deadline"
              type="date"
              min={plan ? today : start}
              required={mode === 'DEADLINE'}
              value={deadline}
              onChange={(event) => {
                setDeadline(event.target.value);
                changed();
              }}
            />
          </div>
          <Button type="submit">{preview.isPending ? 'Calculating…' : 'Preview plan'}</Button>
        </fieldset>
      </form>
      {preview.isError && <p role="alert">{requestError(preview.error)}</p>}
      {save.isError && <p role="alert">{requestError(save.error)} Preview again before saving.</p>}
      {preview.data && (
        <section className="plan-preview" aria-label="Plan preview">
          <h3>Review your schedule</h3>
          <p>
            Projected finish: <strong>{preview.data.schedule.projectedEndDate}</strong>
          </p>
          <p>
            {preview.data.schedule.remainingHours} hours remaining ·{' '}
            {preview.data.schedule.effectiveHoursPerWeek} effective hours per week ·{' '}
            {
              preview.data.schedule.weeks.filter(
                (week) => !week.items.every((item) => item.status === 'DONE') || week.isBuffer,
              ).length
            }{' '}
            scheduled weeks
          </p>
          {preview.data.schedule.warnings.map((warning) => (
            <p key={warning} role="status">
              {warning}
            </p>
          ))}
          {plan && (
            <p>
              Remaining work starts again today. Completed allocations and previous versions are
              preserved.
            </p>
          )}
          <Button disabled={pending} onClick={() => save.mutate(preview.data!)}>
            {save.isPending ? 'Saving…' : plan ? 'Confirm replan' : 'Confirm plan'}
          </Button>{' '}
          <Button variant="outline" disabled={pending} onClick={() => preview.reset()}>
            Cancel
          </Button>
        </section>
      )}
    </section>
  );
}
export function PlanPage() {
  const [saved, setSaved] = useState(false);
  const roadmap = useQuery({
    queryKey: roadmapKey,
    queryFn: getCurrentRoadmap,
    retry: false,
    staleTime: 0,
  });
  const id = roadmap.data?.roadmap?.id;
  const plan = useQuery({
    queryKey: planKey(id ?? ''),
    queryFn: () => getCurrentPlan(id!),
    enabled: !!id,
    retry: false,
    staleTime: 0,
  });
  return (
    <AccountLayout>
      <main className="skills-page">
        <p className="eyebrow">A pace you can keep</p>
        <h1>Weekly plan</h1>
        {roadmap.isPending ? (
          <p role="status">Loading your roadmap…</p>
        ) : roadmap.isError ? (
          <section className="skills-card">
            <p role="alert">{requestError(roadmap.error)}</p>
            <Button onClick={() => void roadmap.refetch()}>Retry roadmap</Button>{' '}
            <Link to="/goals">Choose your goal</Link>
          </section>
        ) : !id ? (
          <section className="skills-card">
            <p>Generate a roadmap before setting your weekly plan.</p>
            <Link className="text-link" to="/roadmap">
              Open roadmap
            </Link>
          </section>
        ) : plan.isPending ? (
          <p role="status">Loading your weekly plan…</p>
        ) : plan.isError ? (
          <section className="skills-card">
            <p role="alert">{requestError(plan.error)}</p>
            <Button onClick={() => void plan.refetch()}>Retry plan</Button>
          </section>
        ) : (
          <>
            {saved && <p role="status">Your weekly plan is saved.</p>}
            <PlanEditor
              key={plan.data?.id ?? id}
              roadmapId={id}
              plan={plan.data ?? null}
              onSaved={() => setSaved(true)}
            />
            {plan.data && (
              <section className="skills-card">
                <h2>Your weeks</h2>
                <p>
                  Version {plan.data.version} · projected finish {plan.data.projectedEndDate}
                </p>
                {plan.data.weeks.length === 0 ? (
                  <p>No remaining work to schedule.</p>
                ) : (
                  plan.data.weeks.map((week) => (
                    <details className="plan-week" key={`${plan.data!.id}-${week.weekNumber}`}>
                      <summary>
                        Week {week.weekNumber} · {week.startDate} · {week.plannedHours} hours
                        {week.isBuffer ? ' · Buffer' : ''}
                      </summary>
                      <p>{week.focusSummary}</p>
                      <ul>
                        {week.items.map((item) => (
                          <li key={item.topicId}>
                            <Link to={`/roadmap#topic-${item.topicId}`}>{item.title}</Link> ·{' '}
                            {item.allocatedHours} hours ·{' '}
                            {item.status.replaceAll('_', ' ').toLowerCase()}
                            {item.isProject ? ' · Project' : ''}
                            {item.id && plan.data?.isActive && (
                              <TaskControl
                                id={item.id}
                                title={item.title ?? 'Learning task'}
                                status={item.status as TaskStatus}
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))
                )}
              </section>
            )}
          </>
        )}
      </main>
    </AccountLayout>
  );
}
