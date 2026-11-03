import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { requestError } from '@/lib/http';
import {
  getResource,
  getAnalytics,
  getSkillProgress,
  studioKeys,
  type SectionDraft,
  downloadFile,
} from '@/features/studio/studio.api';
import { SectionEditor } from '@/features/studio/SectionEditor';
import { StudioAnalytics } from '@/features/studio/StudioAnalytics';
import '@/features/studio/studio.css';
import { useStudioRollover } from '@/features/studio/useStudioRollover';
import { useStudioSettings } from '@/features/studio/useStudioSettings';
export function StudioTrackerPage() {
  const preferences = useStudioSettings();
  const { id = '' } = useParams(),
    client = useQueryClient(),
    navigate = useNavigate();
  const [days, setDays] = useState(30),
    [sections, setSections] = useState<SectionDraft[] | null>(null),
    [kind, setKind] = useState(''),
    [cursor, setCursor] = useState<string>(),
    [deleting, setDeleting] = useState(false),
    [failure, setFailure] = useState('');
  const query = useQuery({ queryKey: ['studio-resource', id], queryFn: () => getResource(id) });
  const tracker = useQuery({
    queryKey: ['studio-analytics', id, days],
    queryFn: () => getAnalytics(id, days),
    refetchInterval: 60000,
  });
  useStudioRollover(tracker.data?.nextRolloverAt);
  const shared = useQuery({ queryKey: studioKeys.progress, queryFn: getSkillProgress });
  const activity = useQuery({
    queryKey: ['studio-activity', id, kind, cursor],
    queryFn: async () =>
      z
        .object({
          events: z.array(
            z.object({
              id: z.string(),
              kind: z.string(),
              title: z.string(),
              createdAt: z.string(),
            }),
          ),
          nextCursor: z.string().nullable(),
        })
        .parse(
          (
            await api.get(`/resources/${id}/activity`, {
              params: { kind, ...(cursor ? { cursor } : {}) },
            })
          ).data.data,
        ),
  });
  const save = useMutation({
    mutationFn: () =>
      api.patch(`/resources/${id}/sections`, { version: query.data!.version, sections }),
    onSuccess: () => {
      setSections(null);
      for (const key of [
        'studio-resource',
        'studio-analytics',
        'studio-activity',
        'studio-skills',
        'current-roadmap',
      ])
        void client.invalidateQueries({ queryKey: [key] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/resources/${id}`),
    onSuccess: () => {
      for (const key of ['studio-resources', 'studio-skills', 'studio-overview', 'current-roadmap'])
        void client.invalidateQueries({ queryKey: [key] });
      void navigate('/studio');
    },
  });
  const confirm = useMutation({
    mutationFn: (skillId: string) => api.patch(`/studio/skills/${skillId}`, { complete: true }),
    onSuccess: () => {
      for (const key of [
        'studio-skills',
        'current-roadmap',
        'progress-summary',
        'my-skills',
        'career-matches',
      ])
        void client.invalidateQueries({ queryKey: [key] });
    },
  });
  const data = query.data;
  const mapped = new Set(
    data?.sections.flatMap((section) => section.skills.map((skill) => skill.skillId)),
  );
  return (
    <AccountLayout>
      <main className="dashboard-main studio-tracker">
        <Link className="text-link" to="/studio">
          ← Learning shelf
        </Link>
        {query.isPending ? (
          <p role="status">Opening your tracker…</p>
        ) : query.isError ? (
          <p role="alert">{requestError(query.error)}</p>
        ) : (
          data && (
            <>
              {data.provider === 'youtube' && (
                <p>
                  <Link to={`/studio/${id}/plan`}>Build or edit your YouTube study schedule →</Link>
                </p>
              )}
              <PageHeader
                eyebrow="Your learning tracker"
                title={data.title}
                description={`${data.done}/${data.total} available items completed. Your notes, practice and progress stay together.`}
              />
              <div className="learning-actions">
                <Button asChild>
                  <Link
                    to={`/studio/${id}/study${tracker.data?.resume ? `?item=${tracker.data.resume.itemId}` : ''}`}
                  >
                    Resume learning
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const result = await api.get<{ data: unknown }>(`/resources/${id}/export`);
                      downloadFile(
                        'linkup-resource.json',
                        JSON.stringify(result.data.data, null, 2),
                        'application/json',
                      );
                    } catch (error) {
                      setFailure(requestError(error));
                    }
                  }}
                >
                  Export my resource data
                </Button>
              </div>
              <div className="form-field">
                <label htmlFor="analytics-range">Activity range</label>
                <select
                  id="analytics-range"
                  value={days}
                  onChange={(event) => setDays(Number(event.target.value))}
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>
              {tracker.data ? (
                <StudioAnalytics data={tracker.data} />
              ) : tracker.error ? (
                <p role="alert">{requestError(tracker.error)}</p>
              ) : (
                <p role="status">Gathering your activity…</p>
              )}
              {shared.data?.progress
                .filter(
                  (row) =>
                    mapped.has(row.skillId) &&
                    row.percent === 100 &&
                    (row.status === 'IN_PROGRESS' ||
                      (preferences.query.data?.confirmSkillCompletion === true &&
                        data.percent === 100)),
                )
                .map((row) => (
                  <section className="skills-card" key={row.skillId}>
                    <h2>{row.skill?.name ?? 'A skill'} is ready to confirm</h2>
                    <p>
                      Your linked chapters are complete. Review your notes and practice, then
                      confirm when you feel ready.
                    </p>
                    <Button
                      disabled={confirm.isPending}
                      onClick={() => confirm.mutate(row.skillId)}
                    >
                      Confirm {row.skill?.name ?? 'completed skill'}
                    </Button>
                  </section>
                ))}
              {confirm.error && <p role="alert">{requestError(confirm.error)}</p>}
              <section className="skills-card">
                <div className="studio-heading">
                  <h2>Your chapters</h2>
                  {!sections && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        setSections(
                          data.sections.map((section) => ({
                            id: section.id,
                            title: section.title,
                            topicSummary: section.topicSummary,
                            topicTags: section.topicTags,
                            skills: section.skills.map(({ skillId, confidence }) => ({
                              skillId,
                              confidence,
                            })),
                            itemKeys: section.items.map((item) => item.id),
                          })),
                        )
                      }
                    >
                      Edit chapters and skills
                    </Button>
                  )}
                </div>
                {sections ? (
                  <>
                    <SectionEditor
                      sections={sections}
                      items={data.sections.flatMap((section) =>
                        section.items.map((item) => ({
                          key: item.id,
                          title: item.title,
                          durationSec: item.durationSec,
                          available: item.available,
                        })),
                      )}
                      names={Object.fromEntries(
                        data.sections.flatMap((section) =>
                          section.skills.map((skill) => [skill.skillId, skill.skill.name]),
                        ),
                      )}
                      onChange={setSections}
                    />
                    <div className="learning-actions">
                      <Button disabled={save.isPending} onClick={() => save.mutate()}>
                        Save chapter changes
                      </Button>
                      <Button
                        variant="outline"
                        disabled={save.isPending}
                        onClick={() => setSections(null)}
                      >
                        Cancel edits
                      </Button>
                    </div>
                    {save.error && <p role="alert">{requestError(save.error)}</p>}
                  </>
                ) : (
                  data.sections.map((section) => (
                    <div key={section.id}>
                      <h3>{section.title}</h3>
                      <p>{section.topicSummary}</p>
                      <progress
                        aria-label={`${section.title} completion`}
                        max={Math.max(1, section.items.filter((item) => item.available).length)}
                        value={
                          section.items.filter(
                            (item) => item.available && item.progress?.status === 'completed',
                          ).length
                        }
                      />
                      <p>
                        {section.skills.map((skill) => skill.skill.name).join(' · ') ||
                          'No skill mapping yet. You can add one in chapter editing.'}
                      </p>
                    </div>
                  ))
                )}
              </section>
              <section className="skills-card">
                <h2>Your activity trail</h2>
                <div className="form-field">
                  <label htmlFor="activity-filter">Show activity</label>
                  <select
                    id="activity-filter"
                    value={kind}
                    onChange={(event) => {
                      setKind(event.target.value);
                      setCursor(undefined);
                    }}
                  >
                    <option value="">All activity</option>
                    {[
                      'imported',
                      'section_started',
                      'video_started',
                      'video_completed',
                      'video_reopened',
                      'note_added',
                      'snippet_added',
                      'snippet_run',
                      'section_completed',
                      'resource_completed',
                      'sections_updated',
                    ].map((value) => (
                      <option key={value} value={value}>
                        {value.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                {activity.isError && <p role="alert">{requestError(activity.error)}</p>}
                <ul className="studio-activity">
                  {activity.data?.events.map((event) => (
                    <li key={event.id}>
                      <strong>{event.kind.replaceAll('_', ' ')}</strong>
                      <time dateTime={event.createdAt}>
                        {new Date(event.createdAt).toLocaleString()}
                      </time>
                      <span>{event.title}</span>
                    </li>
                  ))}
                </ul>
                <div className="learning-actions">
                  {cursor && (
                    <Button variant="outline" onClick={() => setCursor(undefined)}>
                      Most recent activity
                    </Button>
                  )}
                  {activity.data?.nextCursor && (
                    <Button variant="outline" onClick={() => setCursor(activity.data!.nextCursor!)}>
                      Earlier activity
                    </Button>
                  )}
                </div>
              </section>
              <details className="skills-card studio-danger">
                <summary>Remove this learning resource</summary>
                <p>
                  Deleting removes this resource’s items, notes, snippets and resource activity.
                  Existing manually completed roadmap skills and other resources stay saved. Export
                  your data first if you want a copy.
                </p>
                {deleting ? (
                  <div className="learning-actions">
                    <Button disabled={remove.isPending} onClick={() => remove.mutate()}>
                      Delete resource and its saved work
                    </Button>
                    <Button variant="outline" onClick={() => setDeleting(false)}>
                      Keep resource
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setDeleting(true)}>
                    Review deletion
                  </Button>
                )}
                {remove.error && <p role="alert">{requestError(remove.error)}</p>}
              </details>
              {failure && <p role="alert">{failure}</p>}
            </>
          )
        )}
      </main>
    </AccountLayout>
  );
}
