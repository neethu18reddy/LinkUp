import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import {
  snippetSchema,
  type StudioSnippet,
  type StudioResource,
  timestamp,
  downloadFile,
} from './studio.api';
import { useStudioDraft } from './useStudioDraft';
import { browserRunner, type RunResult } from './studio.sandbox';
const CodeEditor = lazy(() => import('./StudioCodeEditor'));
const templates: Record<StudioSnippet['language'], string> = {
  javascript: 'const greeting = "Hello, learner!";\nconsole.log(greeting);',
  typescript: 'const greeting: string = "Hello, learner!";\nconsole.log(greeting);',
  python: 'greeting = "Hello, learner!"\nprint(greeting)',
  html: '<h1>Hello, learner!</h1>\n<p>Try something small.</p>',
  css: 'body { font-family: system-ui; padding: 24px; color: rebeccapurple; }',
  java: 'class Main { public static void main(String[] args) { System.out.println("Hello!"); } }',
  c: '#include <stdio.h>\nint main(void) { printf("Hello!\\n"); return 0; }',
  cpp: '#include <iostream>\nint main() { std::cout << "Hello!"; }',
  go: 'package main\nimport "fmt"\nfunc main() { fmt.Println("Hello!") }',
};
export function SnippetsPanel({
  resource,
  itemId,
  position,
  runSignal,
  createSignal,
}: {
  resource: StudioResource;
  itemId: string;
  position: () => number;
  runSignal: number;
  createSignal: number;
}) {
  const client = useQueryClient(),
    userId = useAuth((state) => state.user?.id),
    preview = useRef<HTMLDivElement>(null),
    actions = useRef({ run: () => {}, create: () => {} });
  const [search, setSearch] = useState(''),
    [running, setRunning] = useState(false),
    [result, setResult] = useState<RunResult | null>(null),
    [failure, setFailure] = useState('');
  const initial = (): StudioSnippet => ({
    id: crypto.randomUUID(),
    resourceId: resource.id,
    itemId,
    title: 'My practice',
    language: 'javascript',
    code: templates.javascript,
    timestampSec:
      resource.sections.flatMap((section) => section.items).find((item) => item.id === itemId)
        ?.progress?.lastPositionSec ?? 0,
    version: 0,
  });
  const state = useStudioDraft(
    `linkup:studio:${userId}:${resource.id}:${itemId}:code`,
    initial(),
    snippetSchema,
    async (draft) => {
      const version = draft.version;
      const body = Object.fromEntries(
        Object.entries(draft).filter(([key]) => !['version', 'updatedAt'].includes(key)),
      );
      return snippetSchema.parse(
        (await api.post('/snippets', { ...body, ...(version ? { version } : {}) })).data.data,
      );
    },
    () => {
      void client.invalidateQueries({ queryKey: ['studio-snippets', resource.id] });
      void client.invalidateQueries({ queryKey: ['studio-overview'] });
    },
  );
  const snippets = useQuery({
    queryKey: ['studio-snippets', resource.id, search],
    queryFn: async () =>
      z
        .array(snippetSchema)
        .parse(
          (await api.get('/snippets', { params: { resourceId: resource.id, search } })).data.data,
        ),
  });
  const versions = useQuery({
    queryKey: ['studio-snippet-versions', state.draft.id, state.draft.version],
    queryFn: async () =>
      z
        .array(z.object({ id: z.string(), code: z.string(), savedAt: z.string() }))
        .parse((await api.get(`/snippets/${state.draft.id}/versions`)).data.data),
    enabled: state.draft.version > 0,
  });
  const supported = browserRunner.supports(state.draft.language);
  const run = async () => {
    if (running || state.pending || !supported) return;
    setRunning(true);
    setFailure('');
    try {
      const saved = state.dirty || !state.draft.version ? await state.saveNow() : state.draft;
      const output = await browserRunner.run(
        saved.language,
        saved.code,
        preview.current ?? undefined,
      );
      setResult(output);
      await api.post(`/snippets/${saved.id}/runs`, {
        id: crypto.randomUUID(),
        status: output.status,
        durationMs: Math.min(120000, output.durationMs),
      });
    } catch (error) {
      setResult({ status: 'error', stdout: '', stderr: requestError(error), durationMs: 0 });
    } finally {
      setRunning(false);
    }
  };
  useEffect(() => {
    actions.current = {
      run: () => void run(),
      create: () => {
        if (!state.blocked) state.select({ ...initial(), timestampSec: Math.floor(position()) });
      },
    };
  });
  useEffect(() => {
    if (runSignal) actions.current.run();
  }, [runSignal]);
  useEffect(() => {
    if (createSignal) actions.current.create();
  }, [createSignal]);
  return (
    <div className="studio-code">
      <div className="studio-heading">
        <h3>Your practice space</h3>
        <Button
          variant="outline"
          disabled={state.blocked || running}
          onClick={() => state.select({ ...initial(), timestampSec: Math.floor(position()) })}
        >
          New snippet
        </Button>
      </div>
      <div className="form-field">
        <label htmlFor="snippet-title">Snippet title</label>
        <input
          id="snippet-title"
          value={state.draft.title}
          maxLength={200}
          onChange={(event) => state.change({ title: event.target.value })}
        />
      </div>
      <div className="form-field">
        <label htmlFor="snippet-language">Language</label>
        <select
          id="snippet-language"
          value={state.draft.language}
          onChange={(event) => {
            const language = event.target.value as StudioSnippet['language'];
            state.change({ language, code: templates[language] });
            setResult(null);
          }}
        >
          {Object.keys(templates).map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>
      </div>
      <p className="field-hint">
        Captured at {timestamp(state.draft.timestampSec)}. Ctrl/Cmd+Enter runs an example. Changing
        language loads its starter template.
      </p>
      <Suspense fallback={<p role="status">Opening your code editor…</p>}>
        <CodeEditor
          language={state.draft.language}
          value={state.draft.code}
          onChange={(code) => state.change({ code })}
        />
      </Suspense>
      <p className="studio-save-status" role="status">
        {state.status}
      </p>
      {state.error && (
        <div role="alert">
          {state.error}{' '}
          <Button variant="outline" onClick={state.retry}>
            Retry saving draft
          </Button>
        </div>
      )}
      <div className="studio-inline-actions">
        {supported ? (
          <Button disabled={running || state.pending} onClick={() => void run()}>
            {running
              ? state.draft.language === 'python'
                ? 'Loading Python / running…'
                : 'Running…'
              : 'Run code'}
          </Button>
        ) : (
          <p>
            Run is unavailable for this language. Save, copy or download your code to practice in
            your own environment.
          </p>
        )}
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard
              .writeText(state.draft.code)
              .catch(() => setFailure('Copy was unavailable. Select the code or download it.'));
          }}
        >
          Copy
        </Button>
        <Button
          variant="outline"
          disabled={running}
          onClick={() => state.change({ code: templates[state.draft.language] })}
        >
          Reset template
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            downloadFile(
              `practice.${{ javascript: 'js', typescript: 'ts', python: 'py', html: 'html', css: 'css', java: 'java', cpp: 'cpp', c: 'c', go: 'go' }[state.draft.language]}`,
              state.draft.code,
            )
          }
        >
          Download
        </Button>
      </div>
      <p className="field-hint">
        Runs are isolated from LinkUp’s account, cookies and storage. Python loads only when Run is
        selected. Execution stops after 5 seconds; first-time Python loading may take longer.
      </p>
      {failure && <p role="status">{failure}</p>}
      <div ref={preview} />
      {result && (
        <section aria-label="Code output">
          <div className="studio-heading">
            <h4>
              Output · {result.status} · {result.durationMs}ms
            </h4>
            <Button variant="outline" onClick={() => setResult(null)}>
              Clear
            </Button>
          </div>
          <pre className="studio-output">
            {result.stdout || '(no stdout)'}
            {result.stderr ? `\n\nstderr:\n${result.stderr}` : ''}
          </pre>
        </section>
      )}
      <details>
        <summary>Recent versions · last 20 saves</summary>
        {versions.data?.map((version) => (
          <div key={version.id}>
            <time>{new Date(version.savedAt).toLocaleString()}</time>
            <Button
              variant="outline"
              disabled={running}
              onClick={() => state.change({ code: version.code })}
            >
              Restore as current draft
            </Button>
          </div>
        ))}
      </details>
      <div className="form-field">
        <label htmlFor="snippet-search">Search saved snippets</label>
        <input
          id="snippet-search"
          value={search}
          type="search"
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {snippets.data
        ?.filter((snippet) => snippet.itemId === itemId || !snippet.itemId)
        .map((snippet) => (
          <article className="studio-note" key={snippet.id}>
            <strong>{snippet.title}</strong>
            <p>
              {snippet.language} · {timestamp(snippet.timestampSec)}
            </p>
            <div className="studio-inline-actions">
              <Button
                variant="outline"
                disabled={state.blocked || running}
                onClick={() => state.select(snippet)}
              >
                Open snippet
              </Button>
              <Button
                variant="outline"
                disabled={state.draft.id === snippet.id && state.blocked}
                onClick={async () => {
                  try {
                    await api.delete(`/snippets/${snippet.id}`);
                    void snippets.refetch();
                    if (state.draft.id === snippet.id) state.select(initial());
                  } catch (error) {
                    setFailure(requestError(error));
                  }
                }}
              >
                Delete snippet
              </Button>
            </div>
          </article>
        ))}
      {snippets.error && <p role="alert">{requestError(snippets.error)}</p>}
    </div>
  );
}
