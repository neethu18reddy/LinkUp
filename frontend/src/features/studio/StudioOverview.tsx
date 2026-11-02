import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { getAnalytics, studioKeys } from './studio.api';
import { useStudioSettings } from './useStudioSettings';
import './studio.css';
import { useStudioRollover } from './useStudioRollover';
const recapSchema = z.object({
  localDate: z.string(),
  title: z.string(),
  videos: z.number(),
  minutes: z.number(),
  loggedMinutes: z.number().default(0),
  skillsCompleted: z.number().default(0),
  notes: z.number(),
  snippets: z.number(),
  topics: z.array(z.string()),
  streak: z.number(),
  encouragement: z.string(),
  emoji: z.boolean(),
  next: z.object({ resourceId: z.string(), itemId: z.string(), title: z.string() }).nullable(),
});
export function StudioOverview() {
  const settings = useStudioSettings();
  const query = useQuery({
    queryKey: studioKeys.overview,
    queryFn: () => getAnalytics(undefined, 7),
    enabled: settings.ready,
    refetchInterval: 60000,
  });
  useStudioRollover(query.data?.nextRolloverAt);
  const recap = useQuery({
    queryKey: ['studio-recap', settings.query.data?.timezone, query.data?.today],
    queryFn: async () => recapSchema.parse((await api.get('/recap/today')).data.data),
    enabled: settings.ready && !!query.data?.today,
    refetchInterval: 60000,
  });
  if (settings.query.isError || settings.save.isError || query.isError)
    return (
      <section className="skills-card">
        <h2>Learning Studio</h2>
        <p role="alert">
          {requestError(settings.query.error ?? settings.save.error ?? query.error)}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            if (settings.save.isError && settings.query.data)
              settings.save.mutate({
                ...settings.query.data,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
              });
            else void query.refetch();
          }}
        >
          Retry Studio
        </Button>
      </section>
    );
  if (!query.data)
    return (
      <section className="skills-card">
        <h2>Learning Studio</h2>
        <p role="status">Opening your learning space…</p>
      </section>
    );
  const data = query.data,
    today = data.daily.at(-1);
  return (
    <>
      <section className="skills-card studio-overview">
        <div className="studio-heading">
          <div>
            <span className="journey-eyebrow">Small steps, steady growth</span>
            <h2>Today in Learning Studio</h2>
          </div>
          <Button asChild variant="outline">
            <Link to="/studio">Open Studio</Link>
          </Button>
        </div>
        <div className="studio-metrics">
          <div>
            <strong>{Math.round((today?.secondsWatched ?? 0) / 60)} min</strong>
            <span>Today · {data.timezone}</span>
          </div>
          <div>
            <strong>
              {Math.round(data.daily.reduce((sum, day) => sum + day.secondsWatched, 0) / 60)} min
            </strong>
            <span>Past seven days</span>
          </div>
          <div>
            <strong>
              {settings.query.data?.emojiRecap ? '🔥 ' : ''}
              {data.streak.current}
            </strong>
            <span>Day streak · best {data.streak.longest}</span>
          </div>
          <div>
            <strong>{data.activeResources}</strong>
            <span>Active resources</span>
          </div>
        </div>
        <p>
          Today’s goal: {data.goal.actual}/{data.goal.target} {data.goal.type}. Every focused minute
          counts.
        </p>
        <progress
          aria-label="Daily learning goal"
          max={data.goal.target}
          value={Math.min(data.goal.target, data.goal.actual)}
        />
        {data.resume ? (
          <Button asChild>
            <Link to={`/studio/${data.resume.resourceId}/study?item=${data.resume.itemId}`}>
              Continue {data.resume.title}
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link to="/studio">Paste a playlist link to begin</Link>
          </Button>
        )}
      </section>
      {!!data.skills.filter((skill) => !skill.beforeTracking && skill.percent > 0).length && (
        <section className="skills-card">
          <h2>Skills moving forward</h2>
          <div className="goal-filters">
            {data.skills
              .filter((skill) => !skill.beforeTracking && skill.percent > 0)
              .slice(0, 5)
              .map((skill) => (
                <Link key={skill.skillId} to="/roadmap" className="journey-status">
                  {skill.name} · {skill.percent}%
                </Link>
              ))}
          </div>
        </section>
      )}
      {!!data.history.length && (
        <details className="skills-card">
          <summary>Your earlier progress stays with you</summary>
          <ul>
            {data.history.slice(0, 15).map((event, index) => (
              <li key={index}>
                {event.name} · {event.status.toLowerCase().replaceAll('_', ' ')} ·{' '}
                {event.occurredAt
                  ? new Date(event.occurredAt).toLocaleDateString()
                  : 'Before tracking began'}
              </li>
            ))}
          </ul>
          <p className="field-hint">{data.legacy.notice}</p>
        </details>
      )}
      {recap.data && (
        <section className="skills-card studio-recap">
          <h2>
            {recap.data.title}
            {recap.data.emoji ? ' 🌟' : ''}
          </h2>
          <p>
            {recap.data.localDate} · {recap.data.videos} videos · {recap.data.minutes} watched min
            {recap.data.loggedMinutes ? ` + ${recap.data.loggedMinutes} logged min` : ''} ·{' '}
            {recap.data.skillsCompleted} skills ready · {recap.data.notes} notes ·{' '}
            {recap.data.snippets} snippets
          </p>
          <div className="goal-filters">
            {recap.data.topics.map((topic) => (
              <span className="journey-status" key={topic}>
                {topic}
              </span>
            ))}
          </div>
          <p>
            {recap.data.streak} day streak · {recap.data.encouragement}
          </p>
          {recap.data.next && (
            <Link
              className="text-link"
              to={`/studio/${recap.data.next.resourceId}/study?item=${recap.data.next.itemId}`}
            >
              {recap.data.next.title}
            </Link>
          )}
        </section>
      )}
    </>
  );
}
