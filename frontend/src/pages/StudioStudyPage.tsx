import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { requestError } from '@/lib/http';
import {
  getResource,
  duration,
  timestamp,
  type StudioResource,
} from '@/features/studio/studio.api';
import { YouTubeStudyPlayer, type PlayerControls } from '@/features/studio/YouTubeStudyPlayer';
import { useStudioSettings } from '@/features/studio/useStudioSettings';
import '@/features/studio/studio.css';
const NotesPanel = lazy(() =>
  import('@/features/studio/NotesPanel').then((module) => ({ default: module.NotesPanel })),
);
const SnippetsPanel = lazy(() =>
  import('@/features/studio/SnippetsPanel').then((module) => ({ default: module.SnippetsPanel })),
);
export function StudioStudyPage() {
  const { id = '' } = useParams(),
    [params, setParams] = useSearchParams(),
    client = useQueryClient(),
    settings = useStudioSettings();
  const query = useQuery({ queryKey: ['studio-resource', id], queryFn: () => getResource(id) });
  const [tab, setTab] = useState(params.get('tab') === 'code' ? 'code' : 'notes'),
    [panel, setPanel] = useState(true),
    [help, setHelp] = useState(false),
    [capture, setCapture] = useState(0),
    [runSignal, setRunSignal] = useState(0),
    [createSignal, setCreateSignal] = useState(0),
    [autoPlay, setAutoPlay] = useState(false);
  const [width, setWidth] = useState(() => {
    try {
      const value = Number(localStorage.getItem('linkup:studio-panel-width'));
      return value >= 30 && value <= 60 ? value : 40;
    } catch {
      return 40;
    }
  });
  const layout = useRef<HTMLDivElement>(null),
    controls = useRef<PlayerControls>({ position: () => 0, seek: () => {} }),
    tabs = useRef<HTMLDivElement>(null);
  const data = query.data,
    items = data?.sections.flatMap((section) => section.items) ?? [];
  const item =
    items.find((item) => item.id === params.get('item')) ??
    items.find((item) => item.available && item.progress?.status !== 'completed') ??
    items.find((item) => item.available) ??
    items[0];
  useEffect(() => {
    if (item?.id && !params.has('item')) {
      const next = new URLSearchParams(params);
      next.set('item', item.id);
      setParams(next, { replace: true });
    }
  }, [item?.id, params, setParams]);
  const select = useCallback(
    (itemId: string, autoplay = false) => {
      setAutoPlay(autoplay);
      setParams({ item: itemId, tab });
    },
    [setParams, tab],
  );
  const position = useCallback(() => controls.current.position(), []),
    seek = useCallback((seconds: number) => controls.current.seek(seconds), []);
  const complete = useMutation({
    mutationFn: (input: { itemId: string; complete: boolean }) =>
      api.post('/progress/complete', input),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: ['studio-resource', id] });
      const previous = client.getQueryData<StudioResource>(['studio-resource', id]);
      if (previous) {
        const sections = previous.sections.map((section) => ({
          ...section,
          items: section.items.map((row) =>
            row.id === input.itemId
              ? {
                  ...row,
                  progress: {
                    watchedSec: 0,
                    contentWatchedSec: 0,
                    lastPositionSec: 0,
                    ...row.progress,
                    status: input.complete ? 'completed' : 'in_progress',
                    completedBy: 'manual',
                  },
                }
              : row,
          ),
        }));
        const done = sections
          .flatMap((section) => section.items)
          .filter((row) => row.available && row.progress?.status === 'completed').length;
        client.setQueryData<StudioResource>(['studio-resource', id], {
          ...previous,
          sections,
          done,
          percent: previous.total ? Math.round((done / previous.total) * 100) : 0,
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) client.setQueryData(['studio-resource', id], context.previous);
    },
    onSettled: () => {
      for (const key of [
        'studio-resource',
        'studio-resources',
        'studio-skills',
        'studio-overview',
        'studio-analytics',
        'current-roadmap',
        'progress-summary',
        'my-skills',
        'plan',
        'career-matches',
      ])
        void client.invalidateQueries({ queryKey: [key] });
    },
  });
  const next = () => {
    const index = items.findIndex((row) => row.id === item?.id),
      following = items.slice(index + 1).find((row) => row.available);
    if (following) select(following.id, settings.query.data?.autoplayNext === true);
  };
  const keyActions = useRef({ next: () => {}, previous: () => {} });
  useEffect(() => {
    keyActions.current = {
      next: () => next(),
      previous: () => {
        const index = items.findIndex((row) => row.id === item?.id),
          previous = items
            .slice(0, index)
            .reverse()
            .find((row) => row.available);
        if (previous) select(previous.id);
      },
    };
  });
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.closest('input,textarea,select,[contenteditable=true],.cm-editor');
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        setTab('code');
        setRunSignal((value) => value + 1);
        return;
      }
      if (editing || !event.altKey) return;
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setTab('notes');
        setCapture((value) => value + 1);
      }
      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        setTab('code');
        setCreateSignal((value) => value + 1);
      }
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setPanel((value) => !value);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        keyActions.current.next();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        keyActions.current.previous();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const resize = (value: number) => {
    const bounded = Math.max(30, Math.min(60, value));
    setWidth(bounded);
    try {
      localStorage.setItem('linkup:studio-panel-width', String(bounded));
    } catch {
      /* unavailable storage */
    }
  };
  return (
    <AccountLayout>
      <main className="dashboard-main studio-study">
        <Link className="text-link" to="/studio">
          ← Learning shelf
        </Link>
        {query.isPending ? (
          <p role="status">Opening your study space…</p>
        ) : query.isError ? (
          <>
            <p role="alert">{requestError(query.error)}</p>
            <Button onClick={() => void query.refetch()}>Retry</Button>
          </>
        ) : data && item ? (
          <>
            <div className="studio-heading">
              <div>
                <p className="journey-eyebrow">{data.title}</p>
                <h1>{item.title}</h1>
                <p>
                  {data.done}/{data.total} items complete · {duration(item.durationSec)} · Resume
                  near {timestamp(item.progress?.lastPositionSec ?? 0)}
                </p>
              </div>
              <div className="learning-actions">
                <Button variant="outline" aria-pressed={panel} onClick={() => setPanel(!panel)}>
                  {panel ? 'Hide side panel' : 'Show side panel'}
                </Button>
                <Button variant="outline" aria-expanded={help} onClick={() => setHelp(!help)}>
                  ?
                </Button>
                <Link to={`/studio/${id}`} className="text-link">
                  My tracker
                </Link>
              </div>
            </div>
            {help && (
              <section className="skills-card">
                <h2>Study shortcuts</h2>
                <p>
                  Alt+N: timestamped note · Alt+C: new snippet · Ctrl/Cmd+Enter: run code · Alt+P:
                  toggle panel · Alt+Left/Right: previous/next video.
                </p>
                <p>
                  Shortcuts are ignored while typing, except Ctrl/Cmd+Enter. Autoplay is off until
                  you enable it in your learning preferences.
                </p>
              </section>
            )}
            <div
              className="studio-study-layout"
              ref={layout}
              style={
                {
                  '--studio-panel': `${width}%`,
                  ...(panel ? {} : { gridTemplateColumns: '1fr' }),
                } as React.CSSProperties
              }
            >
              <section className="studio-player-shell" aria-label="Learning player">
                {item.available && item.externalVideoId ? (
                  <YouTubeStudyPlayer
                    key={item.id}
                    item={item}
                    controls={controls}
                    autoplay={autoPlay && settings.query.data?.autoplayNext === true}
                    initialPosition={params.has('at') ? Number(params.get('at')) : undefined}
                    onEnded={() => {
                      if (settings.query.data?.autoplayNext) next();
                    }}
                  />
                ) : (
                  <section className="skills-card">
                    <h2>{item.available ? 'Your learning item' : 'Video unavailable'}</h2>
                    <p>
                      {item.available
                        ? 'Study this resource in its original location, then mark it complete here.'
                        : 'Private, deleted or restricted videos stay in your plan but are excluded from completion totals.'}
                    </p>
                    {item.url && (
                      <a
                        className="text-link"
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open original resource
                      </a>
                    )}
                  </section>
                )}
                <div className="learning-actions">
                  <Button
                    disabled={!item.available || complete.isPending}
                    onClick={() =>
                      complete.mutate({
                        itemId: item.id,
                        complete: item.progress?.status !== 'completed',
                      })
                    }
                  >
                    {complete.isPending
                      ? 'Saving…'
                      : item.progress?.status === 'completed'
                        ? 'Mark incomplete'
                        : 'Mark complete'}
                  </Button>
                  <Button variant="outline" onClick={next}>
                    Next item
                  </Button>
                </div>
                {complete.error && <p role="alert">{requestError(complete.error)}</p>}
                {item.progress?.completedBy === 'manual' &&
                  item.progress.status !== 'completed' && (
                    <p className="field-hint">
                      You marked this item incomplete for review. Mark it complete when you’re
                      ready; automatic completion will respect your choice.
                    </p>
                  )}
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={settings.query.data?.autoplayNext ?? false}
                    disabled={!settings.query.data || settings.save.isPending}
                    onChange={(event) => {
                      if (settings.query.data)
                        settings.save.mutate({
                          ...settings.query.data,
                          autoplayNext: event.target.checked,
                        });
                    }}
                  />{' '}
                  Automatically play the next video
                </label>
              </section>
              {panel && (
                <>
                  <div
                    role="separator"
                    tabIndex={0}
                    aria-label="Resize study side panel"
                    aria-orientation="vertical"
                    aria-valuenow={Math.round(width)}
                    aria-valuemin={30}
                    aria-valuemax={60}
                    className="studio-divider"
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowLeft') resize(width + 2);
                      if (event.key === 'ArrowRight') resize(width - 2);
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      if (
                        event.currentTarget.hasPointerCapture(event.pointerId) &&
                        layout.current
                      ) {
                        const bounds = layout.current.getBoundingClientRect();
                        resize(((bounds.right - event.clientX) / bounds.width) * 100);
                      }
                    }}
                    onPointerUp={(event) =>
                      event.currentTarget.releasePointerCapture(event.pointerId)
                    }
                  />
                  <section className="studio-study-panel">
                    <div
                      className="studio-tabs"
                      ref={tabs}
                      role="tablist"
                      aria-label="Study panels"
                      onKeyDown={(event) => {
                        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                        event.preventDefault();
                        const options = ['notes', 'code', 'queue'],
                          index = options.indexOf(tab),
                          selected = options[(index + (event.key === 'ArrowRight' ? 1 : 2)) % 3]!;
                        setTab(selected);
                        tabs.current
                          ?.querySelector<HTMLButtonElement>(`[data-tab="${selected}"]`)
                          ?.focus();
                      }}
                    >
                      {[
                        ['notes', 'Notes'],
                        ['code', 'Code'],
                        ['queue', 'Sections / Queue'],
                      ].map(([key, label]) => (
                        <button
                          id={`studio-tab-${key}`}
                          data-tab={key}
                          role="tab"
                          key={key}
                          aria-selected={tab === key}
                          aria-controls={`studio-panel-${key}`}
                          tabIndex={tab === key ? 0 : -1}
                          onClick={() => setTab(key!)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div
                      id={`studio-panel-${tab}`}
                      role="tabpanel"
                      aria-labelledby={`studio-tab-${tab}`}
                      tabIndex={0}
                      className="studio-tab-content"
                    >
                      <Suspense fallback={<p role="status">Opening your {tab}…</p>}>
                        {tab === 'notes' && (
                          <NotesPanel
                            key={item.id}
                            resource={data}
                            itemId={item.id}
                            position={position}
                            seek={seek}
                            capture={capture}
                          />
                        )}
                        {tab === 'code' && (
                          <SnippetsPanel
                            key={item.id}
                            resource={data}
                            itemId={item.id}
                            position={position}
                            runSignal={runSignal}
                            createSignal={createSignal}
                          />
                        )}
                        {tab === 'queue' &&
                          data.sections.map((section) => (
                            <details
                              key={section.id}
                              open={section.items.some((row) => row.id === item.id)}
                            >
                              <summary>
                                {section.title} ·{' '}
                                {
                                  section.items.filter(
                                    (row) => row.progress?.status === 'completed',
                                  ).length
                                }
                                /{section.items.filter((row) => row.available).length}
                              </summary>
                              <p>{section.topicSummary}</p>
                              <ul className="studio-queue">
                                {section.items.map((row) => (
                                  <li key={row.id}>
                                    <button
                                      type="button"
                                      disabled={!row.available}
                                      aria-current={row.id === item.id}
                                      onClick={() => select(row.id)}
                                    >
                                      {row.progress?.status === 'completed' ? '✓ Done · ' : ''}
                                      {row.title}
                                      <small>
                                        {row.available
                                          ? duration(row.durationSec)
                                          : 'Unavailable · not counted'}
                                      </small>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ))}
                      </Suspense>
                    </div>
                  </section>
                </>
              )}
            </div>
            {settings.save.error && <p role="alert">{requestError(settings.save.error)}</p>}
          </>
        ) : (
          <section className="skills-card">
            <h2>No learning items yet</h2>
            <Link to="/studio">Import a resource to begin</Link>
          </section>
        )}
      </main>
    </AccountLayout>
  );
}
