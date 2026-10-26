import { afterEach, describe, it, expect, vi } from 'vitest';
import { readMentorEvents, streamMessage } from './chat.api';
import { useAuth } from '@/store/auth';
import { refreshSession } from '@/features/auth/auth.client';
import { chatSession, chatMessages } from '@/test/chat-fixture';
vi.mock('@/features/auth/auth.client', () => ({
  refreshSession: vi.fn(),
  clearLocalSession: vi.fn(),
}));
const frame = (event: string, data: unknown) =>
  `event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;
const done = () => frame('done', { session: chatSession, messages: chatMessages });
function response(parts: Uint8Array[]) {
  return new Response(
    new ReadableStream({
      start(controller) {
        parts.forEach((part) => controller.enqueue(part));
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}
function signIn() {
  useAuth.getState().setSession(
    {
      id: '83000000-0000-4000-8000-000000000001',
      name: 'Learner',
      email: 'learner@example.test',
      role: 'USER',
      createdAt: '2026-10-27T00:00:00.000Z',
    },
    'old-token',
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  useAuth.getState().clearSession();
});
describe('SSE parsing and authenticated fetch', () => {
  it('parses fragmented UTF-8, CRLF frames and heartbeat comments', async () => {
    const text = `: keepalive\r\n\r\n${frame('delta', { text: 'Learn React 🙂' })}${done()}`;
    const bytes = new TextEncoder().encode(text),
      events: unknown[] = [];
    await readMentorEvents(
      response(Array.from({ length: bytes.length }, (_, index) => bytes.slice(index, index + 1))),
      (event) => events.push(event),
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ event: 'delta', data: { text: 'Learn React 🙂' } });
  });
  it('rejects truncated output without a saved-turn acknowledgement', async () => {
    await expect(
      readMentorEvents(
        response([new TextEncoder().encode(frame('delta', { text: 'Partial' }))]),
        () => {},
      ),
    ).rejects.toThrow('before it was saved');
  });
  it('surfaces safe server errors and rejects invalid event payloads', async () => {
    await expect(
      readMentorEvents(
        response([
          new TextEncoder().encode(
            frame('error', { code: 'CHAT_QUOTA', message: 'Daily quota reached.' }),
          ),
        ]),
        () => {},
      ),
    ).rejects.toThrow('Daily quota');
    await expect(
      readMentorEvents(
        response([new TextEncoder().encode('event: delta\ndata: not json\n\n')]),
        () => {},
      ),
    ).rejects.toThrow('invalid response');
  });
  it('caps accumulated reply text', async () => {
    await expect(
      readMentorEvents(
        response([
          new TextEncoder().encode(
            frame('delta', { text: 'x'.repeat(10000) }) +
              frame('delta', { text: 'x'.repeat(3000) }),
          ),
        ]),
        () => {},
      ),
    ).rejects.toThrow('too long');
  });
  it('refreshes once before streaming after an expired access token', async () => {
    signIn();
    vi.mocked(refreshSession).mockImplementation(async () => {
      useAuth.setState({ accessToken: 'new-token' });
      return 'new-token';
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValue(response([new TextEncoder().encode(done())]));
    vi.stubGlobal('fetch', fetch);
    await streamMessage(
      {
        sessionId: null,
        requestId: crypto.randomUUID(),
        expectedVersion: 0,
        message: 'Next topic?',
      },
      new AbortController().signal,
      () => {},
    );
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[1]![1].headers.Authorization).toBe('Bearer new-token');
  });
  it('keeps HTTP error messages and never exposes raw response text', async () => {
    signIn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Conversation not found.' } }), {
          status: 404,
        }),
      ),
    );
    await expect(
      streamMessage(
        { sessionId: null, requestId: crypto.randomUUID(), expectedVersion: 0, message: 'Help' },
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow('Conversation not found.');
  });
});
