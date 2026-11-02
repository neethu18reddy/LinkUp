import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import {
  noteSchema,
  type StudioNote,
  type StudioResource,
  timestamp,
  downloadFile,
} from './studio.api';
import { useStudioDraft } from './useStudioDraft';

export function NotesPanel({
  resource,
  itemId,
  position,
  seek,
  capture,
}: {
  resource: StudioResource;
  itemId: string;
  position: () => number;
  seek: (seconds: number) => void;
  capture: number;
}) {
  const userId = useAuth((state) => state.user?.id),
    client = useQueryClient(),
    editor = useRef<HTMLTextAreaElement>(null);
  const [search, setSearch] = useState(''),
    [scope, setScope] = useState('video'),
    [failure, setFailure] = useState('');
  const initial = (): StudioNote => ({
    id: crypto.randomUUID(),
    resourceId: resource.id,
    itemId,
    timestampSec:
      resource.sections.flatMap((section) => section.items).find((item) => item.id === itemId)
        ?.progress?.lastPositionSec ?? 0,
    bodyMd: '',
    type: 'Key idea',
    pinned: false,
    tags: [],
    version: 0,
  });
  const state = useStudioDraft(
    `linkup:studio:${userId}:${resource.id}:${itemId}:note`,
    initial(),
    noteSchema,
    async (draft) => {
      const version = draft.version;
      const body = Object.fromEntries(
        Object.entries(draft).filter(([key]) => !['version', 'updatedAt'].includes(key)),
      );
      return noteSchema.parse(
        (await api.post('/notes', { ...body, ...(version ? { version } : {}) })).data.data,
      );
    },
    () => {
      void client.invalidateQueries({ queryKey: ['studio-notes', resource.id] });
      void client.invalidateQueries({ queryKey: ['studio-overview'] });
    },
  );
  const notes = useQuery({
    queryKey: ['studio-notes', resource.id, search],
    queryFn: async () =>
      z
        .array(noteSchema)
        .parse(
          (await api.get('/notes', { params: { resourceId: resource.id, search } })).data.data,
        ),
  });
  const item = resource.sections
    .flatMap((section) => section.items)
    .find((item) => item.id === itemId)!;
  const currentSection = resource.sections.find((section) =>
    section.items.some((item) => item.id === itemId),
  );
  const shown =
    notes.data?.filter((note) =>
      scope === 'resource' || scope === 'video'
        ? scope === 'resource' || note.itemId === itemId
        : currentSection?.items.some((item) => item.id === note.itemId),
    ) ?? [];
  const exportNotes = async () => {
    try {
      const data = z
        .array(noteSchema)
        .parse((await api.get(`/resources/${resource.id}/export`)).data.data.notes);
      const selected = data.filter((note) =>
        scope === 'resource' || scope === 'video'
          ? scope === 'resource' || note.itemId === itemId
          : currentSection?.items.some((item) => item.id === note.itemId),
      );
      downloadFile(
        'linkup-notes.md',
        `# ${resource.title}\n\n` +
          selected
            .map((note) => {
              const video = resource.sections
                .flatMap((section) => section.items)
                .find((item) => item.id === note.itemId);
              return `## ${video?.title ?? 'Resource note'} · ${timestamp(note.timestampSec)} · ${note.type}\n\n${note.bodyMd}\n\n${video?.externalVideoId ? `[Watch on YouTube](https://www.youtube.com/watch?v=${video.externalVideoId}&t=${Math.floor(note.timestampSec)})` : ''}`;
            })
            .join('\n\n---\n\n'),
        'text/markdown',
      );
    } catch (error) {
      setFailure(requestError(error));
    }
  };
  const captureAction = useRef(() => {});
  useEffect(() => {
    captureAction.current = () => {
      state.change({ timestampSec: Math.floor(position()) });
      editor.current?.focus();
    };
  });
  useEffect(() => {
    if (capture) captureAction.current();
  }, [capture]);
  return (
    <div className="studio-notes">
      <div className="studio-heading">
        <h3>Your notes</h3>
        <Button
          variant="outline"
          disabled={state.blocked}
          onClick={() => {
            state.select(initial());
            editor.current?.focus();
          }}
        >
          New note
        </Button>
      </div>
      <p className="field-hint">
        {item.title} ·{' '}
        <button className="text-link" type="button" onClick={() => seek(state.draft.timestampSec)}>
          {timestamp(state.draft.timestampSec)}
        </button>{' '}
        <Button
          variant="outline"
          onClick={() => {
            state.change({ timestampSec: Math.floor(position()) });
            editor.current?.focus();
          }}
        >
          Capture timestamp
        </Button>
      </p>
      <div className="form-field">
        <label htmlFor="note-type">Note type</label>
        <select
          id="note-type"
          value={state.draft.type}
          onChange={(event) => state.change({ type: event.target.value as StudioNote['type'] })}
        >
          {['Key idea', 'Question', 'Todo', 'Definition', 'Warning'].map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </div>
      <label htmlFor="note-body">Write in Markdown</label>
      <textarea
        ref={editor}
        id="note-body"
        value={state.draft.bodyMd}
        maxLength={20000}
        onChange={(event) => state.change({ bodyMd: event.target.value })}
        placeholder="What clicked? What would you like to try?"
      />
      <div className="form-field">
        <label htmlFor="note-tags">Tags, separated by commas</label>
        <input
          id="note-tags"
          key={state.draft.id}
          defaultValue={state.draft.tags.join(', ')}
          onBlur={(event) =>
            state.change({
              tags: event.target.value
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean)
                .slice(0, 10),
            })
          }
        />
      </div>
      <label className="studio-check">
        <input
          type="checkbox"
          checked={state.draft.pinned}
          onChange={(event) => state.change({ pinned: event.target.checked })}
        />{' '}
        Pin this idea
      </label>
      <p className="studio-save-status" role="status">
        {state.status}
        {state.blocked ? ' · Finish saving before switching notes.' : ''}
      </p>
      {state.error && (
        <div role="alert">
          <p>{state.error}</p>
          <Button variant="outline" onClick={state.retry}>
            Retry saving draft
          </Button>
        </div>
      )}
      <details>
        <summary>Live Markdown preview</summary>
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
          {state.draft.bodyMd || '*Your preview appears here.*'}
        </ReactMarkdown>
      </details>
      <hr />
      <div className="form-field">
        <label htmlFor="note-search">Search saved notes</label>
        <input
          id="note-search"
          type="search"
          maxLength={100}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="form-field">
        <label htmlFor="note-scope">Show and export</label>
        <select id="note-scope" value={scope} onChange={(event) => setScope(event.target.value)}>
          <option value="video">This video</option>
          <option value="section">This chapter</option>
          <option value="resource">Whole resource</option>
        </select>
      </div>
      <Button variant="outline" onClick={() => void exportNotes()}>
        Export notes as Markdown
      </Button>
      {failure && <p role="alert">{failure}</p>}
      {notes.isError && <p role="alert">{requestError(notes.error)}</p>}
      {shown.map((note) => (
        <article className="studio-note" key={note.id}>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              if (note.itemId === itemId) seek(note.timestampSec);
              else
                window.location.assign(
                  `/studio/${resource.id}/study?item=${note.itemId}&at=${note.timestampSec}`,
                );
            }}
          >
            {timestamp(note.timestampSec)} · {note.type}
            {note.pinned ? ' · Pinned' : ''}
          </button>
          <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
            {note.bodyMd}
          </ReactMarkdown>
          <div className="studio-inline-actions">
            <Button variant="outline" disabled={state.blocked} onClick={() => state.select(note)}>
              Edit note
            </Button>
            <Button
              variant="outline"
              disabled={state.draft.id === note.id && state.blocked}
              onClick={async () => {
                try {
                  await api.delete(`/notes/${note.id}`);
                  void notes.refetch();
                  if (state.draft.id === note.id) state.select(initial());
                } catch (error) {
                  setFailure(requestError(error));
                }
              }}
            >
              Delete note
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
