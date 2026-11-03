import OpenAI from 'openai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env, parseEnv } from '../src/config/env.js';
import { buildMentorContext } from '../src/ai/mentor.context.js';
import {
  InceptionMentorProvider,
  GeminiMentorProvider,
  configuredMentorProvider,
} from '../src/ai/mentor.groq.js';
import { FallbackMentorProvider } from '../src/ai/mentor.fallback.js';
import { GEMINI_MODEL, geminiCallBudget } from '../src/ai/gemini.limits.js';
import { configuredProvider } from '../src/ai/roadmap.provider.js';
import type { MentorProvider } from '../src/ai/mentor.provider.js';
import { AppError } from '../src/utils/AppError.js';

const originalEnv = { ...env };
const input = {
  message: 'Explain loops.',
  history: [{ role: 'USER' as const, content: 'I am learning Python.' }],
  context: buildMentorContext({ roadmap: null, plan: null, days: [] }, [], '2026-11-03', {
    name: 'Private learner',
    email: 'private@example.test',
  }),
};
afterEach(() => {
  Object.assign(env, originalEnv);
  env.INCEPTION_API_KEY = originalEnv.INCEPTION_API_KEY;
  env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function collect(
  provider: MentorProvider,
  signal = new AbortController().signal,
  selected = vi.fn(),
) {
  let text = '';
  for await (const chunk of provider.stream(input, signal, selected)) text += chunk;
  return text;
}
function source(mode: string, chunks: string[] = ['An answer.'], failure?: Error) {
  const called = vi.fn();
  const provider: MentorProvider = {
    mode,
    async *stream() {
      called();
      for (const text of chunks) yield text;
      if (failure) throw failure;
    },
  };
  return { provider, called };
}
function streamResponse(text: string) {
  return new Response(
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`,
    {
      headers: { 'content-type': 'text/event-stream' },
    },
  );
}
describe('Inception mentor configuration and transport', () => {
  it('validates the new settings and retains existing defaults', () => {
    expect(parseEnv({ NODE_ENV: 'test' })).toMatchObject({
      MENTOR_PROVIDER: 'inherit',
      MENTOR_FALLBACK_PROVIDER: 'disabled',
    });
    expect(
      parseEnv({
        NODE_ENV: 'test',
        MENTOR_PROVIDER: 'inception',
        MENTOR_FALLBACK_PROVIDER: 'gemini',
      }).MENTOR_PROVIDER,
    ).toBe('inception');
    expect(() => parseEnv({ NODE_ENV: 'test', MENTOR_PROVIDER: 'unknown' })).toThrow();
  });
  it('requires approval and complete keys without changing roadmap selection', () => {
    env.MENTOR_PROVIDER = 'inception';
    env.MENTOR_FALLBACK_PROVIDER = 'gemini';
    env.LLM_PROVIDER = 'gemini';
    env.LLM_LIVE_CALLS_APPROVED = false;
    expect(configuredMentorProvider().mode).toBe('offline');
    env.LLM_LIVE_CALLS_APPROVED = true;
    env.INCEPTION_API_KEY = undefined;
    expect(() => configuredMentorProvider()).toThrow('INCEPTION_API_KEY');
    env.INCEPTION_API_KEY = 'fake-inception';
    env.GEMINI_API_KEY = undefined;
    expect(() => configuredMentorProvider()).toThrow('GEMINI_API_KEY');
    env.GEMINI_API_KEY = 'fake-google';
    expect(configuredMentorProvider().mode).toBe('inception');
    expect(configuredProvider()?.name).toBe('gemini');
    env.LLM_PROVIDER = 'disabled';
    expect(configuredProvider()).toBeUndefined();
    expect(configuredMentorProvider().mode).toBe('inception');
    env.MENTOR_PROVIDER = 'disabled';
    expect(configuredMentorProvider().mode).toBe('offline');
  });
  it('uses the fixed endpoint, pinned model, low reasoning and one streaming request', async () => {
    const transport = vi.fn().mockResolvedValue(streamResponse('Try a loop.'));
    vi.stubGlobal('fetch', transport);
    const selected = vi.fn();
    expect(await collect(new InceptionMentorProvider('fake-inception'), undefined, selected)).toBe(
      'Try a loop.',
    );
    expect(transport).toHaveBeenCalledTimes(1);
    expect(String(transport.mock.calls[0]![0])).toBe(
      'https://api.inceptionlabs.ai/v1/chat/completions',
    );
    const payload = JSON.parse(transport.mock.calls[0]![1].body);
    expect(payload).toMatchObject({
      model: 'mercury-3',
      reasoning_effort: 'low',
      stream: true,
      max_completion_tokens: 1800,
    });
    expect(JSON.stringify(payload)).not.toContain('private@example.test');
    expect(payload.messages.at(-1).content).toBe(input.message);
    expect(selected).toHaveBeenCalledWith('inception');
  });
  it.each([400, 401, 402, 403, 404, 429, 500, 503])(
    'falls back exactly once after Mercury HTTP %i',
    async (status) => {
      const transport = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { message: 'private provider diagnostics' } }), {
            status,
            headers: { 'content-type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(streamResponse('Google answer.'));
      vi.stubGlobal('fetch', transport);
      const release = vi.fn();
      vi.spyOn(geminiCallBudget, 'acquire').mockReturnValue(release);
      const selected = vi.fn();
      const provider = new FallbackMentorProvider(
        new InceptionMentorProvider('fake-inception'),
        new GeminiMentorProvider('fake-google', GEMINI_MODEL),
      );
      expect(await collect(provider, undefined, selected)).toBe('Google answer.');
      expect(transport).toHaveBeenCalledTimes(2);
      expect(String(transport.mock.calls[1]![0])).toContain('generativelanguage.googleapis.com');
      expect(JSON.parse(transport.mock.calls[1]![1].body)).toMatchObject({
        model: GEMINI_MODEL,
        max_tokens: 1800,
      });
      expect(selected.mock.calls).toEqual([['gemini']]);
      expect(geminiCallBudget.acquire).toHaveBeenCalledTimes(1);
      expect(release).toHaveBeenCalledTimes(1);
    },
  );
});
describe('bounded mentor failover', () => {
  it('does not call Gemini when Mercury succeeds', async () => {
    const primary = source('inception', ['Hello ', 'learner.']),
      fallback = source('gemini');
    expect(await collect(new FallbackMentorProvider(primary.provider, fallback.provider))).toBe(
      'Hello learner.',
    );
    expect(fallback.called).not.toHaveBeenCalled();
  });
  it('falls back on an empty or whitespace-only answer without emitting primary whitespace', async () => {
    const primary = source('inception', [' ', '\n']),
      fallback = source('gemini');
    expect(await collect(new FallbackMentorProvider(primary.provider, fallback.provider))).toBe(
      'An answer.',
    );
    expect(fallback.called).toHaveBeenCalledTimes(1);
  });
  it('does not mix a failed partial reply with fallback output', async () => {
    const primary = source('inception', ['Partial answer.'], new Error('private diagnostics')),
      fallback = source('gemini');
    const iterator = new FallbackMentorProvider(primary.provider, fallback.provider).stream(
      input,
      new AbortController().signal,
    );
    expect((await iterator.next()).value).toBe('Partial answer.');
    await expect(iterator.next()).rejects.toMatchObject({ code: 'MENTOR_UNAVAILABLE' });
    expect(fallback.called).not.toHaveBeenCalled();
  });
  it('does not call either provider for an already cancelled request', async () => {
    const primary = source('inception'),
      fallback = source('gemini'),
      controller = new AbortController();
    controller.abort();
    await expect(
      collect(new FallbackMentorProvider(primary.provider, fallback.provider), controller.signal),
    ).rejects.toMatchObject({ code: 'CHAT_CANCELLED' });
    expect(primary.called).not.toHaveBeenCalled();
    expect(fallback.called).not.toHaveBeenCalled();
  });
  it('keeps the 10-second deadline after the first token without switching models', async () => {
    vi.useFakeTimers();
    const fallback = source('gemini');
    const primary: MentorProvider = {
      mode: 'inception',
      async *stream() {
        yield 'Partial answer.';
        await new Promise(() => {});
        yield 'never';
      },
    };
    const iterator = new FallbackMentorProvider(primary, fallback.provider).stream(
      input,
      new AbortController().signal,
    );
    expect((await iterator.next()).value).toBe('Partial answer.');
    const assertion = expect(iterator.next()).rejects.toMatchObject({ code: 'MENTOR_UNAVAILABLE' });
    await vi.advanceTimersByTimeAsync(10000);
    await assertion;
    expect(fallback.called).not.toHaveBeenCalled();
  });
  it('bounds a stalled primary to 10 seconds, aborts it and allows fallback', async () => {
    vi.useFakeTimers();
    let attemptSignal: AbortSignal | undefined;
    const primary: MentorProvider = {
      mode: 'inception',
      async *stream(_input, signal) {
        attemptSignal = signal;
        await new Promise(() => {});
        yield 'never';
      },
    };
    const fallback = source('gemini');
    const result = collect(new FallbackMentorProvider(primary, fallback.provider));
    await vi.advanceTimersByTimeAsync(9999);
    expect(fallback.called).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBe('An answer.');
    expect(attemptSignal?.aborted).toBe(true);
  });
  it('bounds a stalled fallback to 15 seconds and hides both failures', async () => {
    vi.useFakeTimers();
    const primary = source('inception', [], new Error('private primary'));
    const fallback: MentorProvider = {
      mode: 'gemini',
      async *stream() {
        await new Promise(() => {});
        yield 'never';
      },
    };
    const result = collect(new FallbackMentorProvider(primary.provider, fallback));
    const assertion = expect(result).rejects.toMatchObject({ code: 'MENTOR_UNAVAILABLE' });
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
  });
  it('cancels a stalled stream immediately without trying fallback', async () => {
    const controller = new AbortController(),
      fallback = source('gemini');
    const primary: MentorProvider = {
      mode: 'inception',
      async *stream() {
        await new Promise(() => {});
        yield 'never';
      },
    };
    const result = collect(
      new FallbackMentorProvider(primary, fallback.provider),
      controller.signal,
    );
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: 'CHAT_CANCELLED' });
    expect(fallback.called).not.toHaveBeenCalled();
  });
  it('honors the Gemini budget without making a fallback network request', async () => {
    const primary = source('inception', [], new Error('unavailable'));
    vi.spyOn(geminiCallBudget, 'acquire').mockImplementation(() => {
      throw new AppError(429, 'MENTOR_QUOTA', 'Shared limit.');
    });
    const create = vi.fn();
    const fallback = new GeminiMentorProvider('fake-google', GEMINI_MODEL, {
      chat: { completions: { create } },
    } as unknown as OpenAI);
    await expect(
      collect(new FallbackMentorProvider(primary.provider, fallback)),
    ).rejects.toMatchObject({ code: 'MENTOR_QUOTA' });
    expect(create).not.toHaveBeenCalled();
  });
  it('redacts arbitrary failures when both providers fail', async () => {
    const primary = source('inception', [], new Error('private primary')),
      fallback = source('gemini', [], new Error('private fallback'));
    await expect(
      collect(new FallbackMentorProvider(primary.provider, fallback.provider)),
    ).rejects.toThrow('The AI mentor is unavailable. Please retry shortly.');
  });
});
