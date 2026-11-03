import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { requestError } from '@/lib/http';
import { getCurrentGoal, goalKeys } from '@/features/goals/goals.api';
import {
  previewSchema,
  studioResourceSchema,
  getResource,
  studioKeys,
  type ImportPreview,
  type StudioResource,
} from '@/features/studio/studio.api';
import { useStudioSettings } from '@/features/studio/useStudioSettings';
import { SectionEditor } from '@/features/studio/SectionEditor';
import { VideoFinder } from '@/features/youtube/VideoFinder';
import { StudyPlanForm } from '@/features/youtube/StudyPlanForm';
import {
  getStudyPlan,
  saveStudyPlan,
  scheduleSchema,
  languageSchema,
  levelSchema,
  youtubeKeys,
  type PlanningPreferences,
} from '@/features/youtube/youtube.api';
import '@/features/studio/studio.css';
import '@/features/youtube/youtube.css';
function today(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function YouTubeLearningPage() {
  const [params] = useSearchParams(),
    { id } = useParams();
  return <YouTubeLearningWorkspace key={id ?? params.toString()} />;
}
function YouTubeLearningWorkspace() {
  const [params] = useSearchParams(),
    { id } = useParams(),
    navigate = useNavigate(),
    client = useQueryClient();
  const preferences = useStudioSettings();
  const [mode, setMode] = useState<'link' | 'find'>(params.has('url') ? 'link' : 'find'),
    [url, setUrl] = useState(params.get('url') ?? ''),
    [draft, setDraft] = useState<ImportPreview | null>(null),
    [title, setTitle] = useState('My YouTube learning plan'),
    [linkGoal, setLinkGoal] = useState(false),
    [created, setCreated] = useState<StudioResource | null>(null);
  const goal = useQuery({ queryKey: goalKeys.current, queryFn: getCurrentGoal });
  const saved = useQuery({
    queryKey: ['youtube-plan', id],
    queryFn: () => getStudyPlan(id!),
    enabled: !!id,
  });
  const resource = useQuery({
    queryKey: ['studio-resource', id],
    queryFn: () => getResource(id!),
    enabled: !!id,
  });
  const plans = useQuery({
    queryKey: youtubeKeys.plans,
    queryFn: async () =>
      z
        .array(
          z.object({
            resourceId: z.string(),
            goal: z.string(),
            resource: z.object({ title: z.string() }),
          }),
        )
        .parse((await api.get('/youtube/plans')).data.data),
  });
  const preview = useMutation({
    mutationFn: async () =>
      previewSchema.parse(
        (
          await api.post('/resources/import/preview', {
            provider: 'youtube',
            input: url,
            title: 'My YouTube learning plan',
          })
        ).data.data,
      ),
    onSuccess: (data) => {
      setDraft(data);
      setTitle(data.title);
      setCreated(null);
    },
  });
  const timezone =
    (preferences.query.data?.timezoneConfirmed
      ? preferences.query.data.timezone
      : Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
  const initial = (name: string): PlanningPreferences => ({
    goal: params.get('topic') || name,
    level: levelSchema.catch('beginner').parse(params.get('level')),
    language: languageSchema.catch('both').parse(params.get('language')),
    timezone,
    dailyMinutes:
      preferences.query.data?.dailyGoalType === 'minutes'
        ? Math.max(10, Math.min(240, preferences.query.data.dailyGoalValue))
        : 20,
    weekdays: [1, 2, 3, 4, 5],
    startDate: today(timezone),
    targetDate: null,
    estimates: {},
  });
  async function saveNew(p: PlanningPreferences) {
    const plan = draft!;
    let item = created;
    if (!item) {
      item = studioResourceSchema.parse(
        (
          await api.post('/resources', {
            previewToken: plan.previewToken,
            title,
            sections: plan.sections,
            targetRoleId: linkGoal ? (goal.data?.roleTemplateId ?? null) : null,
          })
        ).data.data,
      );
      setCreated(item);
    }
    const keys = plan.sections.flatMap((s) => s.itemKeys),
      items = item.sections.flatMap((s) => s.items);
    const estimates = Object.fromEntries(
      items.flatMap((row, i) => (p.estimates[keys[i]!] ? [[row.id, p.estimates[keys[i]!]!]] : [])),
    );
    await saveStudyPlan(item.id, 0, { ...p, estimates });
    void client.invalidateQueries({ queryKey: youtubeKeys.plans });
    void client.invalidateQueries({ queryKey: studioKeys.resources });
    void navigate(`/youtube/${item.id}`);
  }
  return (
    <AccountLayout>
      <main className="dashboard-main youtube-page">
        <PageHeader
          eyebrow="Learn your way"
          title="YouTube Learning"
          description="Bring a favorite playlist or find videos for your topic. Build a study plan that fits your week."
        />
        {id ? (
          <>
            <p>
              <Link to="/youtube">← Your YouTube plans</Link> ·{' '}
              <Link to={`/studio/${id}/study`}>Continue in Learning Studio</Link> ·{' '}
              <Link to={`/studio/${id}`}>Edit chapters and skill mappings</Link>
            </p>
            {saved.isPending || resource.isPending || preferences.query.isPending ? (
              <p role="status">Loading your study plan…</p>
            ) : saved.isError || resource.isError ? (
              <p role="alert">{requestError(saved.error ?? resource.error)}</p>
            ) : (
              resource.data && (
                <>
                  <h2>{resource.data.title}</h2>
                  {saved.data?.stale && (
                    <p className="youtube-status" role="status">
                      Your chapters changed. Preview and save to refresh this schedule. Saved video
                      progress is kept.
                    </p>
                  )}
                  <StudyPlanForm
                    key={`${id}-${saved.data?.version ?? 0}`}
                    initial={saved.data?.preferences ?? initial(resource.data.title)}
                    initialSchedule={saved.data?.stale ? undefined : saved.data?.schedule}
                    resourceId={id}
                    unknownItems={resource.data.sections
                      .flatMap((s) => s.items)
                      .filter((i) => i.available && !i.durationSec)
                      .map((i) => ({ id: i.id, title: i.title }))}
                    build={async (p) =>
                      scheduleSchema.parse(
                        (await api.post(`/resources/${id}/study-plan/preview`, { preferences: p }))
                          .data.data,
                      )
                    }
                    save={async (p) => {
                      const result = await saveStudyPlan(id, saved.data?.version ?? 0, p);
                      client.setQueryData(['youtube-plan', id], result);
                      void client.invalidateQueries({ queryKey: youtubeKeys.plans });
                      return result;
                    }}
                  />
                </>
              )
            )}
          </>
        ) : (
          <>
            <div className="youtube-start-options">
              <Button
                variant={mode === 'link' ? 'glow' : 'outline'}
                onClick={() => setMode('link')}
              >
                I have a video or playlist
              </Button>
              <Button
                variant={mode === 'find' ? 'glow' : 'outline'}
                onClick={() => setMode('find')}
              >
                Help me choose
              </Button>
            </div>
            {mode === 'find' ? (
              <VideoFinder initialTopic={params.get('topic') ?? ''} />
            ) : (
              <section className="youtube-plan-card">
                <h2>Bring a favorite YouTube link</h2>
                <p>
                  Paste one video or playlist link. We’ll use that exact content and keep its order.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    preview.mutate();
                  }}
                >
                  <div className="form-field">
                    <label htmlFor="favorite-youtube-link">Favorite video or playlist URL</label>
                    <input
                      id="favorite-youtube-link"
                      type="url"
                      required
                      maxLength={2048}
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.youtube.com/playlist?list=…"
                    />
                  </div>
                  <Button type="submit" disabled={preview.isPending || !!created}>
                    {preview.isPending ? 'Loading your videos…' : 'Load my video or playlist'}
                  </Button>
                </form>
                {preview.isError && <p role="alert">{requestError(preview.error)}</p>}
              </section>
            )}
            {mode === 'link' && draft && (
              <div className="youtube-plan-layout">
                {draft.notice && <p role="status">{draft.notice}</p>}
                <section className="youtube-plan-card">
                  <h2>Review chapters and skills</h2>
                  <div className="form-field">
                    <label htmlFor="youtube-resource-title">Plan title</label>
                    <input
                      id="youtube-resource-title"
                      required
                      maxLength={200}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={!!created}
                    />
                  </div>
                  {!created ? (
                    <>
                      <SectionEditor
                        sections={draft.sections}
                        items={draft.items}
                        names={draft.skillNames}
                        onChange={(sections) => setDraft({ ...draft, sections })}
                      />
                      {goal.data && (
                        <label>
                          <input
                            type="checkbox"
                            checked={linkGoal}
                            onChange={(e) => setLinkGoal(e.target.checked)}
                          />{' '}
                          Link mapped skills to my current career goal
                        </label>
                      )}
                    </>
                  ) : (
                    <p role="status">
                      Your resource is saved. Finish saving the schedule below; your import will not
                      be duplicated.
                    </p>
                  )}
                </section>
                {preferences.query.isPending ? (
                  <p role="status">Loading your study preferences…</p>
                ) : (
                  <StudyPlanForm
                    key={`${draft.previewToken.slice(-40)}-${JSON.stringify(draft.sections)}`}
                    initial={initial(draft.title)}
                    unknownItems={draft.items
                      .filter((i) => i.available && !i.durationSec)
                      .map((i) => ({ id: i.key, title: i.title }))}
                    build={async (p) =>
                      scheduleSchema.parse(
                        (
                          await api.post('/resources/import/study-plan-preview', {
                            previewToken: draft.previewToken,
                            sections: draft.sections,
                            preferences: p,
                          })
                        ).data.data,
                      )
                    }
                    save={saveNew}
                  />
                )}
              </div>
            )}
            <section className="youtube-plan-card" style={{ marginTop: 24 }}>
              <h2>Your saved YouTube plans</h2>
              {plans.isPending ? (
                <p>Loading plans…</p>
              ) : plans.isError ? (
                <p role="alert">{requestError(plans.error)}</p>
              ) : plans.data?.length ? (
                <ul>
                  {plans.data.map((plan) => (
                    <li key={plan.resourceId}>
                      <Link to={`/youtube/${plan.resourceId}`}>{plan.resource.title}</Link> ·{' '}
                      {plan.goal}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Your first saved plan will appear here.</p>
              )}
            </section>
          </>
        )}
      </main>
    </AccountLayout>
  );
}
