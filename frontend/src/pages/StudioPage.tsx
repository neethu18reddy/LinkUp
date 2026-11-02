import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { requestError } from '@/lib/http';
import {
  previewSchema,
  getResources,
  studioResourceSchema,
  studioKeys,
  type ImportPreview,
  duration,
  noteSchema,
  snippetSchema,
} from '@/features/studio/studio.api';
import { SectionEditor } from '@/features/studio/SectionEditor';
import { StudioOverview } from '@/features/studio/StudioOverview';
import { StudioPreferences } from '@/features/studio/StudioPreferences';
import '@/features/studio/studio.css';
import { getCurrentGoal, goalKeys } from '@/features/goals/goals.api';

export function StudioPage() {
  const client = useQueryClient(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const [page, setPage] = useState(1),
    [importing, setImporting] = useState(params.has('skill')),
    [provider, setProvider] = useState<'youtube' | 'custom'>('youtube'),
    [input, setInput] = useState(''),
    [title, setTitle] = useState('My learning playlist'),
    [draft, setDraft] = useState<ImportPreview | null>(null),
    [search, setSearch] = useState('');
  const [linkGoal, setLinkGoal] = useState(params.has('skill'));
  const goal = useQuery({ queryKey: goalKeys.current, queryFn: getCurrentGoal });
  const selectedSkill = useQuery({
    queryKey: ['studio-attached-skill', params.get('skill')],
    queryFn: async () =>
      z
        .object({ id: z.string(), name: z.string() })
        .parse((await api.get(`/studio/skills/${params.get('skill')}`)).data.data),
    enabled: !!params.get('skill'),
  });
  const resources = useQuery({
    queryKey: [...studioKeys.resources, page],
    queryFn: () => getResources(page),
  });
  const noteSearch = useQuery({
    queryKey: ['studio-global-notes', search],
    queryFn: async () =>
      z.array(noteSchema).parse((await api.get('/notes', { params: { search } })).data.data),
    enabled: search.length >= 2,
  });
  const codeSearch = useQuery({
    queryKey: ['studio-global-snippets', search],
    queryFn: async () =>
      z.array(snippetSchema).parse((await api.get('/snippets', { params: { search } })).data.data),
    enabled: search.length >= 2,
  });
  const preview = useMutation({
    mutationFn: async () =>
      previewSchema.parse(
        (
          await api.post('/resources/import/preview', {
            provider,
            input: provider === 'youtube' ? input : '',
            title,
            ...(provider === 'custom'
              ? {
                  items: input
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => {
                      const [name = '', url] = line.split('|').map((part) => part.trim());
                      return { title: name, ...(url ? { url } : {}) };
                    }),
                }
              : {}),
          })
        ).data.data,
      ),
    onSuccess: (data) => {
      if (selectedSkill.data) {
        const skill = selectedSkill.data;
        data.skillNames[skill.id] = skill.name;
        for (const section of data.sections)
          if (!section.skills.some((row) => row.skillId === skill.id))
            section.skills.push({ skillId: skill.id, confidence: 1 });
      }
      setDraft(data);
      setTitle(data.title);
    },
  });
  const save = useMutation({
    mutationFn: async () =>
      studioResourceSchema.parse(
        (
          await api.post('/resources', {
            previewToken: draft!.previewToken,
            title,
            sections: draft!.sections,
            targetRoleId: linkGoal ? (goal.data?.roleTemplateId ?? null) : null,
          })
        ).data.data,
      ),
    onSuccess: (data) => {
      void client.invalidateQueries({ queryKey: studioKeys.resources });
      void client.invalidateQueries({ queryKey: studioKeys.progress });
      void navigate(`/studio/${data.id}/study`);
    },
  });
  return (
    <AccountLayout>
      <main className="dashboard-main studio-library">
        <PageHeader
          eyebrow="Your learning space"
          title="Learning Studio"
          description="Bring your playlist. Watch, take notes and practice, one small chapter at a time."
        />
        <StudioOverview />
        <div className="studio-heading">
          <h2>Your learning shelf</h2>
          <Button aria-expanded={importing} onClick={() => setImporting(!importing)}>
            {importing ? 'Close import' : 'Add a learning resource'}
          </Button>
        </div>
        {importing && (
          <section className="skills-card">
            <h2>{draft ? 'Make this plan yours' : 'Bring your playlist'}</h2>
            {selectedSkill.data && (
              <p>
                Linked to your roadmap skill: <strong>{selectedSkill.data.name}</strong>. Review the
                chapter mappings before saving.
              </p>
            )}
            {!draft ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  preview.mutate();
                }}
              >
                <div className="form-field">
                  <label htmlFor="resource-provider">Learning source</label>
                  <select
                    id="resource-provider"
                    value={provider}
                    onChange={(event) => setProvider(event.target.value as typeof provider)}
                  >
                    <option value="youtube">YouTube playlist or videos</option>
                    <option value="custom">Custom checklist, articles or course</option>
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="resource-title">Resource title</label>
                  <input
                    id="resource-title"
                    value={title}
                    maxLength={200}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="resource-import">
                    {provider === 'youtube'
                      ? 'Playlist URL, one video URL, or video URLs on separate lines'
                      : 'One learning item per line. Optional: Title | https://your-resource-link'}
                  </label>
                  <textarea
                    id="resource-import"
                    rows={6}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    required
                    maxLength={150000}
                  />
                </div>
                <Button disabled={preview.isPending}>
                  {preview.isPending ? 'Preparing your preview…' : 'Preview learning plan'}
                </Button>
                {preview.error && <p role="alert">{requestError(preview.error)}</p>}
                <p className="field-hint">
                  YouTube videos remain on YouTube. If playlist metadata is unavailable, paste
                  individual video URLs or use a custom checklist.
                </p>
              </form>
            ) : (
              <>
                <div className="form-field">
                  <label htmlFor="preview-title">Plan title</label>
                  <input
                    id="preview-title"
                    maxLength={200}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <p>
                  {draft.channel} · {draft.items.filter((item) => item.available).length} available
                  items ·{' '}
                  {duration(
                    draft.items
                      .filter((item) => item.available)
                      .reduce((sum, item) => sum + item.durationSec, 0),
                  )}
                </p>
                {draft.notice && <p role="status">{draft.notice}</p>}
                <SectionEditor
                  sections={draft.sections}
                  items={draft.items}
                  names={draft.skillNames}
                  onChange={(sections) => setDraft({ ...draft, sections })}
                />
                <div className="learning-actions">
                  <Button disabled={save.isPending || !title.trim()} onClick={() => save.mutate()}>
                    {save.isPending ? 'Saving your learning plan…' : 'Save plan'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={save.isPending}
                    onClick={() => setDraft(null)}
                  >
                    Start another preview
                  </Button>
                </div>
                {save.error && <p role="alert">{requestError(save.error)}</p>}
              </>
            )}
          </section>
        )}
        {resources.isPending ? (
          <p role="status">Loading your shelf…</p>
        ) : resources.isError ? (
          <p role="alert">{requestError(resources.error)}</p>
        ) : !resources.data.resources.length ? (
          <section className="skills-card">
            <h2>A little space for your next big idea</h2>
            <p>
              Paste a playlist link to begin, or turn your own reading list into a learning plan.
            </p>
            <Button onClick={() => setImporting(true)}>Add my first resource</Button>
          </section>
        ) : (
          <>
            <div className="studio-resource-grid">
              {resources.data.resources.map((resource) => (
                <article className="skills-card" key={resource.id}>
                  <span className="journey-eyebrow">
                    {resource.provider === 'youtube' ? 'YouTube learning' : 'Your custom plan'}
                  </span>
                  <h3>{resource.title}</h3>
                  <p>{resource.channel}</p>
                  <p>
                    {resource.done}/{resource.total} items done ·{' '}
                    {duration(resource.totalDurationSec)}
                  </p>
                  <progress
                    aria-label={`${resource.title} completion`}
                    max={Math.max(1, resource.total)}
                    value={resource.done}
                  />
                  <div className="learning-actions">
                    {goal.data?.roleTemplateId && (
                      <label className="studio-check">
                        <input
                          type="checkbox"
                          checked={linkGoal}
                          onChange={(event) => setLinkGoal(event.target.checked)}
                        />
                        Supports my current goal: {goal.data.targetRole}
                      </label>
                    )}
                    <Button asChild>
                      <Link to={`/studio/${resource.id}/study`}>Continue learning</Link>
                    </Button>
                    <Link className="text-link" to={`/studio/${resource.id}`}>
                      Tracker & chapters
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            <div className="learning-actions">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous resources
              </Button>
              <span>Page {page}</span>
              <Button
                variant="outline"
                disabled={page * 12 >= resources.data.total}
                onClick={() => setPage(page + 1)}
              >
                Next resources
              </Button>
            </div>
          </>
        )}
        <section className="skills-card">
          <h2>Find your notes and code</h2>
          <div className="form-field">
            <label htmlFor="studio-global-search">Search across all your resources</label>
            <input
              id="studio-global-search"
              type="search"
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {search.length >= 2 && (
            <>
              <ul>
                {noteSearch.data?.map((note) => (
                  <li key={note.id}>
                    <Link
                      to={`/studio/${note.resourceId}/study${note.itemId ? `?item=${note.itemId}` : ''}`}
                    >
                      Note: {note.bodyMd.slice(0, 100) || note.type}
                    </Link>
                  </li>
                ))}
                {codeSearch.data?.map((snippet) => (
                  <li key={snippet.id}>
                    <Link
                      to={`/studio/${snippet.resourceId}/study${snippet.itemId ? `?item=${snippet.itemId}&` : '?'}tab=code`}
                    >
                      Code: {snippet.title}
                    </Link>
                  </li>
                ))}
              </ul>
              {noteSearch.error || codeSearch.error ? (
                <p role="alert">Could not search saved documents. Please retry.</p>
              ) : (
                !noteSearch.isPending &&
                !codeSearch.isPending &&
                !noteSearch.data?.length &&
                !codeSearch.data?.length && <p>No matching notes or snippets yet.</p>
              )}
            </>
          )}
        </section>
        <StudioPreferences />
      </main>
    </AccountLayout>
  );
}
