import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Bot, Plus, Send, Sparkles, Square } from 'lucide-react';
import { MentorMessage } from '@/features/chat/MentorMessage';
import { requestError } from '@/lib/http';
import {
  getSessions,
  getMentorConfig,
  getHistory,
  deleteHistory,
  streamMessage,
  sessionsKey,
  historyKey,
  MentorError,
  type ChatMessage,
  type HistoryPage,
  type MessageInput,
  type MentorEvent,
} from '@/features/chat/chat.api';
const offlineSuggestions = [
  'How am I doing?',
  'What should I work on next?',
  'Help me review my schedule',
  'How should I approach my project?',
];
const tutoringSuggestions = [
  'Explain my next topic with a worked example.',
  'Quiz me on my current topic, one question at a time.',
  'Help me debug my code.',
  'What should I work on next?',
];
export function ChatPage() {
  const client = useQueryClient();
  const configuration = useQuery({
    queryKey: ['mentor-config'],
    queryFn: getMentorConfig,
    retry: false,
  });
  const sessions = useQuery({ queryKey: sessionsKey, queryFn: getSessions, retry: false });
  const [selection, setSelected] = useState<string | null | undefined>(undefined);
  const selected =
    selection === undefined
      ? (sessions.data?.[0]?.id ?? (sessions.data ? null : undefined))
      : selection;
  const history = useQuery({
    queryKey: historyKey(selected ?? ''),
    queryFn: () => getHistory(selected!),
    enabled: !!selected,
    retry: false,
    staleTime: 0,
  });
  const [older, setOlder] = useState<ChatMessage[]>([]),
    [before, setBefore] = useState<number | null | undefined>();
  const [draft, setDraft] = useState(''),
    [question, setQuestion] = useState(''),
    [partial, setPartial] = useState(''),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [confirmDelete, setConfirmDelete] = useState(false),
    [copied, setCopied] = useState('');
  const controller = useRef<AbortController | null>(null),
    generation = useRef(0);
  const [lastRequest, setLastRequest] = useState<MessageInput | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const followReply = useRef(true);
  const suggestions =
    configuration.data?.mode === 'offline' ? offlineSuggestions : tutoringSuggestions;
  useEffect(() => {
    const panel = conversation.current;
    if (panel && followReply.current) panel.scrollTop = panel.scrollHeight;
  }, [partial, question, history.data]);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  const loadOlder = useMutation({
    mutationFn: async () => {
      const epoch = generation.current;
      const page = await getHistory(
        selected!,
        before === undefined ? history.data!.nextBefore! : before!,
      );
      return { page, epoch };
    },
    onSuccess: ({ page, epoch }) => {
      if (epoch !== generation.current) return;
      setOlder((previous) => [...page.messages, ...previous]);
      setBefore(page.nextBefore);
    },
  });
  const remove = useMutation({
    mutationFn: deleteHistory,
    onSuccess: async () => {
      if (selected) client.removeQueries({ queryKey: historyKey(selected) });
      select(null);
      await client.invalidateQueries({ queryKey: sessionsKey });
    },
  });
  function select(id: string | null) {
    generation.current++;
    controller.current?.abort();
    setSelected(id);
    setOlder([]);
    setBefore(undefined);
    setQuestion('');
    setPartial('');
    setError('');
    setDraft('');
    setPending(false);
    setConfirmDelete(false);
    setLastRequest(null);
    loadOlder.reset();
    remove.reset();
  }
  async function send(input: MessageInput) {
    const epoch = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setLastRequest(input);
    followReply.current = true;
    setPending(true);
    setError('');
    setCopied('');
    setQuestion(input.message);
    setPartial('');
    setDraft('');
    let result: Extract<MentorEvent, { event: 'done' }>['data'] | null = null;
    try {
      await streamMessage(input, abort.signal, (event) => {
        if (epoch !== generation.current) return;
        if (event.event === 'meta') {
          // Keep the reserved session available after a network failure or cancellation.
          setSelected(event.data.session.id);
          client.setQueryData<HistoryPage>(
            historyKey(event.data.session.id),
            (old) =>
              old ?? {
                session: event.data.session,
                messages: [],
                nextBefore: null,
              },
          );
        }
        if (event.event === 'delta') setPartial((previous) => previous + event.data.text);
        if (event.event === 'done') result = event.data;
      });
      if (epoch !== generation.current) return;
      if (!result) throw new MentorError('The reply was not confirmed. Retry to recover it.');
      const saved = result as Extract<MentorEvent, { event: 'done' }>['data'];
      client.setQueryData<HistoryPage>(historyKey(saved.session.id), (old) => {
        const combined = [
          ...(old?.messages ?? []).filter((message) => message.requestId !== input.requestId),
          ...saved.messages,
        ].sort((a, b) => a.position - b.position);
        const messages = combined.slice(-40);
        return {
          session: saved.session,
          messages,
          nextBefore: combined.length > 40 ? messages[0]!.position : (old?.nextBefore ?? null),
        };
      });
      setSelected(saved.session.id);
      setQuestion('');
      setPartial('');
      setLastRequest(null);
      void client.invalidateQueries({ queryKey: historyKey(saved.session.id) });
      void client.invalidateQueries({ queryKey: sessionsKey });
    } catch (failure) {
      if (epoch !== generation.current) return;
      setError(
        abort.signal.aborted
          ? 'Stopped. The reply may already have saved; retry or reload history to check.'
          : failure instanceof MentorError
            ? failure.message
            : requestError(failure),
      );
      void client.invalidateQueries({ queryKey: sessionsKey });
    } finally {
      if (epoch === generation.current) setPending(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || pending || !ready || remove.isPending) return;
    void send({
      sessionId: selected ?? null,
      requestId: crypto.randomUUID(),
      expectedVersion: history.data?.session.version ?? 0,
      message,
    });
  }
  async function copy(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
      setError('');
    } catch {
      setError('Copy failed. Select the reply text to copy it.');
    }
  }
  async function reloadHistory() {
    const epoch = generation.current;
    const refreshed = await history.refetch();
    if (epoch !== generation.current) return;
    if (refreshed.data && lastRequest) {
      if (refreshed.data.messages.some((message) => message.requestId === lastRequest.requestId)) {
        setQuestion('');
        setPartial('');
        setError('');
        setLastRequest(null);
      } else
        setLastRequest({
          ...lastRequest,
          expectedVersion: refreshed.data.session.version,
        });
    }
  }
  const ready =
    !!configuration.data &&
    !sessions.isPending &&
    !sessions.isError &&
    selected !== undefined &&
    (!selected || (!history.isPending && !history.isError));
  const messages = [...older, ...(history.data?.messages ?? [])].filter(
    (message, index, all) => all.findIndex((row) => row.id === message.id) === index,
  );
  const nextBefore = before === undefined ? history.data?.nextBefore : before;
  return (
    <AccountLayout>
      <main className="skills-page mentor-page">
        <PageHeader
          eyebrow="LEARN WITH A LITTLE COMPANY"
          title="Your learning mentor"
          description="Untangle a tricky concept, practise a skill, or find your next small step."
        />
        <div className="mentor-workspace">
          <aside className="mentor-sidebar">
            <div className="mentor-identity">
              <span>
                <Bot size={24} aria-hidden="true" />
              </span>
              <div>
                <strong>linkup mentor</strong>
                <small>
                  {configuration.data?.mode === 'offline'
                    ? 'Offline guidance'
                    : configuration.data
                      ? 'AI learning companion'
                      : 'Connecting…'}
                </small>
              </div>
            </div>
            <Button
              variant="outline"
              disabled={pending || remove.isPending || sessions.isPending || sessions.isError}
              onClick={() => {
                select(null);
                composer.current?.focus();
              }}
            >
              <Plus size={16} aria-hidden="true" />
              New conversation
            </Button>
            <p className="mentor-notice">
              {configuration.data?.mode === 'offline'
                ? 'Offline guidance is active — this is not an AI tutor. It can summarise progress and suggest scheduled tasks, but cannot explain concepts, debug code, or quiz you. No messages are sent to external AI services.'
                : configuration.data
                  ? 'AI mentor is active. Your question, recent chat and anonymised learning context are sent to the configured AI provider. Avoid sharing private information. Replies can be inaccurate; check important explanations.'
                  : configuration.isError
                    ? 'Mentor availability could not be checked. Try reloading before sharing a question.'
                    : 'Checking mentor availability…'}
            </p>
            {configuration.isError && (
              <Button variant="outline" onClick={() => void configuration.refetch()}>
                Retry mentor availability
              </Button>
            )}
            <section className="mentor-history">
              <div className="form-field">
                <label htmlFor="mentor-session">Conversation</label>
                <select
                  id="mentor-session"
                  disabled={pending || sessions.isPending || sessions.isError || remove.isPending}
                  value={selected ?? ''}
                  onChange={(event) => select(event.target.value || null)}
                >
                  <option value="">New conversation</option>
                  {sessions.data?.map((session) => (
                    <option value={session.id} key={session.id}>
                      {session.title} · {session.updatedAt.slice(0, 16).replace('T', ' ')} UTC
                    </option>
                  ))}
                </select>
              </div>
              {sessions.isPending && <p role="status">Loading conversations…</p>}
              {sessions.isError && (
                <>
                  <p role="alert">{requestError(sessions.error)}</p>
                  <Button onClick={() => void sessions.refetch()}>Retry conversations</Button>
                </>
              )}
              {selected && (
                <>
                  {confirmDelete ? (
                    <div>
                      <p>Delete this conversation and its saved messages? This cannot be undone.</p>
                      <Button
                        disabled={pending || remove.isPending}
                        onClick={() => remove.mutate(selected)}
                      >
                        Confirm delete
                      </Button>{' '}
                      <Button
                        variant="outline"
                        disabled={remove.isPending}
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={pending || remove.isPending}
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete conversation
                    </Button>
                  )}
                  {remove.isError && <p role="alert">{requestError(remove.error)}</p>}
                </>
              )}
            </section>
            <div className="mentor-sidebar-tip">
              <Sparkles size={18} aria-hidden="true" />
              <p>
                Try sharing what you have already tried. Your mentor can give more useful feedback
                on a specific question.
              </p>
            </div>
          </aside>
          <div className="mentor-main">
            <section
              className="mentor-conversation"
              aria-label="Mentor conversation"
              ref={conversation}
              onScroll={() => {
                const panel = conversation.current;
                if (panel)
                  followReply.current =
                    panel.scrollHeight - panel.scrollTop - panel.clientHeight < 100;
              }}
            >
              {selected && history.isPending ? (
                <p role="status">Loading messages…</p>
              ) : selected && history.isError ? (
                <>
                  <p role="alert">{requestError(history.error)}</p>
                  <Button onClick={() => void history.refetch()}>Retry history</Button>
                </>
              ) : (
                <>
                  {!!nextBefore && (
                    <Button
                      variant="outline"
                      disabled={pending || loadOlder.isPending}
                      onClick={() => loadOlder.mutate()}
                    >
                      {loadOlder.isPending ? 'Loading…' : 'Load earlier messages'}
                    </Button>
                  )}
                  {loadOlder.isError && <p role="alert">{requestError(loadOlder.error)}</p>}
                  {messages.length === 0 && !question && (
                    <div className="mentor-welcome">
                      <span className="mentor-welcome-icon">
                        <Sparkles size={30} aria-hidden="true" />
                      </span>
                      <h2>
                        {configuration.data?.mode === 'offline'
                          ? 'Review your learning progress'
                          : 'What will we figure out today?'}
                      </h2>
                      <p>
                        No messages yet. Ask about your progress, next topic, schedule or project.
                      </p>
                      <small>
                        {configuration.data?.mode === 'offline'
                          ? 'For detailed tutoring, enable AI in this environment. For now, choose a progress question below.'
                          : 'Tell me the topic, what you have tried, and the part that feels unclear.'}
                      </small>
                    </div>
                  )}
                  {messages.map((message) => (
                    <article
                      className={`mentor-message ${message.role === 'USER' ? 'mentor-user' : ''}`}
                      key={message.id}
                    >
                      <h2>
                        {message.role === 'USER'
                          ? 'You'
                          : message.mode === 'offline'
                            ? 'Mentor · offline guidance'
                            : 'Mentor'}
                      </h2>
                      {message.role === 'ASSISTANT' ? (
                        <MentorMessage content={message.content} />
                      ) : (
                        <p>{message.content}</p>
                      )}
                      {message.role === 'ASSISTANT' && (
                        <Button variant="outline" onClick={() => void copy(message)}>
                          {copied === message.id ? 'Copied' : 'Copy reply'}
                        </Button>
                      )}
                    </article>
                  ))}
                  {question && (
                    <article className="mentor-message mentor-user">
                      <h2>You · awaiting saved reply</h2>
                      <p>{question}</p>
                    </article>
                  )}
                  {partial && (
                    <article className="mentor-message">
                      <h2>Mentor · unsaved reply</h2>
                      <MentorMessage content={partial} />
                    </article>
                  )}
                </>
              )}
              {pending && (
                <p className="mentor-thinking" role="status">
                  <span aria-hidden="true">●</span>{' '}
                  {configuration.data?.mode === 'offline'
                    ? 'Preparing offline guidance…'
                    : partial
                      ? 'Writing your reply…'
                      : 'Thinking through your question…'}
                </p>
              )}
              {error && (
                <div>
                  <p role="alert">{error}</p>
                  {lastRequest && (
                    <Button disabled={pending} onClick={() => void send(lastRequest)}>
                      Retry message
                    </Button>
                  )}
                  {selected && (
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() => void reloadHistory()}
                    >
                      Reload history
                    </Button>
                  )}
                </div>
              )}
            </section>
            <section className="mentor-composer">
              <div className="mentor-suggestions">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    disabled={!ready || pending || remove.isPending}
                    onClick={() => {
                      setDraft(suggestion);
                      composer.current?.focus();
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
              <form onSubmit={submit}>
                <div className="form-field">
                  <label htmlFor="mentor-message">Your learning question</label>
                  <textarea
                    ref={composer}
                    id="mentor-message"
                    required
                    maxLength={1000}
                    value={draft}
                    disabled={!ready || pending || remove.isPending}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Ask for an explanation, a code example, or help with your next task…"
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' &&
                        (event.ctrlKey || event.metaKey) &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                </div>
                <p className="composer-hint">
                  {draft.length}/1000 · Ctrl/⌘ + Enter to send · Up to 30 attempts per UTC day.
                </p>
                <Button
                  variant="glow"
                  type="submit"
                  disabled={!ready || pending || !draft.trim() || remove.isPending}
                >
                  <Send size={16} aria-hidden="true" />
                  Send message
                </Button>{' '}
                {pending && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => controller.current?.abort()}
                  >
                    <Square size={14} aria-hidden="true" />
                    Stop reply
                  </Button>
                )}
              </form>
              <p>
                <Link to="/roadmap">Review roadmap</Link> ·{' '}
                <Link to="/plan">Adjust weekly plan</Link> ·{' '}
                <Link to="/progress">Learning logs and projects</Link>
              </p>
            </section>
          </div>
        </div>
      </main>
    </AccountLayout>
  );
}
