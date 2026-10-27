import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import {
  getProgress,
  progressKey,
  addLog,
  getLogs,
  getProjects,
  submitProject,
} from '@/features/progress/progress.api';
export function ProgressPage() {
  const client = useQueryClient(),
    today = new Date().toISOString().slice(0, 10);
  const summary = useQuery({ queryKey: progressKey, queryFn: getProgress, retry: false });
  const logs = useInfiniteQuery({
    queryKey: ['learning-logs'],
    queryFn: ({ pageParam }) => getLogs(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const roadmapId = summary.data?.roadmap?.id;
  const projects = useQuery({
    queryKey: ['projects', roadmapId],
    queryFn: () => getProjects(roadmapId!),
    enabled: !!roadmapId,
  });
  const [topic, setTopic] = useState(''),
    [minutes, setMinutes] = useState('30'),
    [note, setNote] = useState(''),
    [date, setDate] = useState(today);
  const [projectTopic, setProjectTopic] = useState(''),
    [title, setTitle] = useState(''),
    [url, setUrl] = useState(''),
    [notes, setNotes] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const [message, setMessage] = useState('');
  const log = useMutation({
    mutationFn: addLog,
    onSuccess: async () => {
      setNote('');
      requestId.current = crypto.randomUUID();
      setMessage('Learning log saved.');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['learning-logs'] }),
        client.invalidateQueries({ queryKey: progressKey }),
      ]);
    },
  });
  const project = useMutation({
    mutationFn: submitProject,
    onSuccess: async () => {
      setMessage('Project submission saved.');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['projects'] }),
        client.invalidateQueries({ queryKey: progressKey }),
      ]);
    },
  });
  function logSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    log.mutate({
      requestId: requestId.current,
      topicId: topic || null,
      minutes: Number(minutes),
      note,
      loggedOn: date,
    });
  }
  function projectSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    project.mutate({ topicId: projectTopic, title, repoUrl: url.trim() || null, notes });
  }
  function logChanged() {
    requestId.current = crypto.randomUUID();
    log.reset();
    setMessage('');
  }
  return (
    <AccountLayout>
      <main className="skills-page">
        <PageHeader
          eyebrow="Small steps, recorded"
          title="Learning and projects"
          description="Record your study time, keep project work moving, and see the progress you’ve built."
        />
        {message && <p role="status">{message}</p>}
        {summary.isPending ? (
          <p role="status">Loading your topics…</p>
        ) : summary.isError ? (
          <section className="skills-card">
            <p role="alert">{requestError(summary.error)}</p>
            <Button onClick={() => void summary.refetch()}>Retry topics</Button>
          </section>
        ) : (
          <>
            <section className="skills-card">
              <h2>Log learning</h2>
              <p>
                Logs record time and build your streak. Complete tasks separately in your weekly
                plan.
              </p>
              <form onSubmit={logSubmit}>
                <fieldset className="plan-fields" disabled={log.isPending}>
                  <div className="form-field">
                    <label htmlFor="log-topic">Topic (optional)</label>
                    <select
                      id="log-topic"
                      value={topic}
                      onChange={(event) => {
                        setTopic(event.target.value);
                        logChanged();
                      }}
                    >
                      <option value="">General learning</option>
                      {summary.data.topics.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="log-minutes">Minutes</label>
                    <input
                      id="log-minutes"
                      type="number"
                      min="1"
                      max="720"
                      step="1"
                      required
                      value={minutes}
                      onChange={(event) => {
                        setMinutes(event.target.value);
                        logChanged();
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="log-date">Learning date (UTC)</label>
                    <input
                      id="log-date"
                      type="date"
                      required
                      max={today}
                      min={new Date(Date.parse(today) - 365 * 86400000).toISOString().slice(0, 10)}
                      value={date}
                      onChange={(event) => {
                        setDate(event.target.value);
                        logChanged();
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="log-note">What did you learn?</label>
                    <textarea
                      id="log-note"
                      required
                      maxLength={2000}
                      value={note}
                      onChange={(event) => {
                        setNote(event.target.value);
                        logChanged();
                      }}
                    />
                  </div>
                  <Button type="submit">{log.isPending ? 'Saving…' : 'Save learning log'}</Button>
                </fieldset>
              </form>
              {log.isError && <p role="alert">{requestError(log.error)}</p>}
            </section>
            <section className="skills-card">
              <h2>Submit a project</h2>
              {summary.data.topics.some((topic) => topic.isProject) ? (
                <form onSubmit={projectSubmit}>
                  <fieldset className="plan-fields" disabled={project.isPending}>
                    <div className="form-field">
                      <label htmlFor="project-topic">Project topic</label>
                      <select
                        id="project-topic"
                        required
                        value={projectTopic}
                        onChange={(event) => setProjectTopic(event.target.value)}
                      >
                        <option value="">Choose a project</option>
                        {summary.data.topics
                          .filter((topic) => topic.isProject)
                          .map((topic) => (
                            <option key={topic.id} value={topic.id}>
                              {topic.title}
                              {topic.submitted ? ' (submitted — update)' : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label htmlFor="project-title">Submission title</label>
                      <input
                        id="project-title"
                        required
                        maxLength={200}
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="project-url">Repository or project link (HTTPS)</label>
                      <input
                        id="project-url"
                        type="url"
                        maxLength={2048}
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="project-notes">
                        Notes (at least 10 characters if no link)
                      </label>
                      <textarea
                        id="project-notes"
                        maxLength={5000}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                      />
                    </div>
                    <p>Submitting evidence does not complete your project tasks automatically.</p>
                    <Button type="submit">
                      {project.isPending ? 'Saving…' : 'Save project submission'}
                    </Button>
                  </fieldset>
                </form>
              ) : (
                <p>
                  Generate a roadmap to get project topics. <Link to="/roadmap">Open roadmap</Link>
                </p>
              )}
              {project.isError && <p role="alert">{requestError(project.error)}</p>}
              {roadmapId &&
                (projects.isPending ? (
                  <p role="status">Loading submissions…</p>
                ) : projects.isError ? (
                  <>
                    <p role="alert">{requestError(projects.error)}</p>
                    <Button onClick={() => void projects.refetch()}>Retry submissions</Button>
                  </>
                ) : (
                  <ul>
                    {projects.data.length === 0 && <li>No project submissions yet.</li>}
                    {projects.data.map((project) => (
                      <li key={project.id}>
                        <strong>{project.title}</strong>
                        {project.repoUrl && (
                          <>
                            {' '}
                            ·{' '}
                            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer">
                              Project link
                            </a>
                          </>
                        )}
                        <p>{project.notes}</p>
                      </li>
                    ))}
                  </ul>
                ))}
            </section>
          </>
        )}
        <section className="skills-card">
          <h2>Your learning history</h2>
          {logs.isPending ? (
            <p role="status">Loading logs…</p>
          ) : logs.isError ? (
            <>
              <p role="alert">{requestError(logs.error)}</p>
              <Button onClick={() => void logs.refetch()}>Retry logs</Button>
            </>
          ) : (
            <>
              {logs.data.pages[0]?.logs.length ? (
                <ul>
                  {logs.data.pages
                    .flatMap((page) => page.logs)
                    .map((log) => (
                      <li key={log.id}>
                        <strong>
                          {log.minutes} minutes · {log.loggedAt.slice(0, 10)}
                        </strong>
                        <p>
                          {log.topicTitle ?? 'General learning'} — {log.note}
                        </p>
                      </li>
                    ))}
                </ul>
              ) : (
                <p>No learning logs yet. Record your first session above.</p>
              )}
              {logs.hasNextPage && (
                <Button
                  disabled={logs.isFetchingNextPage}
                  onClick={() => void logs.fetchNextPage()}
                >
                  {logs.isFetchingNextPage ? 'Loading…' : 'Load older logs'}
                </Button>
              )}
            </>
          )}
        </section>
      </main>
    </AccountLayout>
  );
}
