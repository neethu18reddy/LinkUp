import { afterEach, describe, expect, it, vi } from 'vitest';
import { env, parseEnv } from '../src/config/env.js';
import { GeminiMentorProvider, configuredMentorProvider } from '../src/ai/mentor.groq.js';
import {
  GeminiProvider,
  configuredProvider,
  generateValidated,
} from '../src/ai/roadmap.provider.js';
import OpenAI from 'openai';
import { buildMentorContext } from '../src/ai/mentor.context.js';
import { GEMINI_MODEL, GeminiCallBudget } from '../src/ai/gemini.limits.js';

const originalEnv = { ...env };

afterEach(() => {
  Object.assign(env, originalEnv);
  if (!('GEMINI_API_KEY' in originalEnv)) delete env.GEMINI_API_KEY;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Gemini provider', () => {
  it('accepts Gemini configuration but keeps calls disabled until explicitly approved', () => {
    expect(parseEnv({ NODE_ENV: 'test', LLM_PROVIDER: 'gemini' }).LLM_PROVIDER).toBe('gemini');
    env.LLM_PROVIDER = 'gemini';
    env.LLM_LIVE_CALLS_APPROVED = false;
    env.GEMINI_API_KEY = 'fake-key';
    expect(configuredProvider()).toBeUndefined();
    expect(configuredMentorProvider().mode).toBe('offline');
  });

  it('selects Gemini for both features and rejects incomplete approved configuration', () => {
    env.LLM_PROVIDER = 'gemini';
    env.LLM_LIVE_CALLS_APPROVED = true;
    env.GEMINI_API_KEY = undefined;
    expect(() => configuredProvider()).toThrow('GEMINI_API_KEY');
    expect(() => configuredMentorProvider()).toThrow('GEMINI_API_KEY');
    env.GEMINI_API_KEY = 'fake-key';
    env.LLM_MODEL = '';
    expect(configuredProvider()?.name).toBe('gemini');
    expect(configuredMentorProvider().mode).toBe('gemini');
  });

  it('streams through Google with bounded output and anonymised context', async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(
        new Response(
          'data: {"choices":[{"delta":{"content":"Try a small exercise."}}]}\n\ndata: [DONE]\n\n',
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      );
    vi.stubGlobal('fetch', transport);
    const provider = new GeminiMentorProvider('fake-key', 'gemini-test-model');
    const chunks = [];
    for await (const chunk of provider.stream(
      {
        message: 'Explain loops.',
        history: [],
        context: buildMentorContext({ roadmap: null, plan: null, days: [] }, [], '2026-10-27', {
          name: 'Private learner',
          email: 'private@example.test',
        }),
      },
      new AbortController().signal,
    ))
      chunks.push(chunk);
    expect(chunks.join('')).toBe('Try a small exercise.');
    expect(String(transport.mock.calls[0]![0])).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
    const payload = JSON.parse(transport.mock.calls[0]![1].body);
    expect(payload).toMatchObject({
      model: GEMINI_MODEL,
      stream: true,
      max_tokens: 1800,
      reasoning_effort: 'low',
    });
    expect(JSON.stringify(payload)).not.toContain('private@example.test');
  });

  it('requests bounded JSON roadmap output from Google', async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"title":"A roadmap"}' } }],
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', transport);
    expect(
      await new GeminiProvider('fake-key', 'gemini-test-model').generate('Anonymised gaps'),
    ).toBe('{"title":"A roadmap"}');
    const payload = JSON.parse(transport.mock.calls[0]![1].body);
    expect(payload).toMatchObject({
      model: GEMINI_MODEL,
      max_tokens: 6000,
      response_format: { type: 'json_object' },
    });
  });

  it('hides Google failure details from mentor responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: 'Private provider diagnostics', type: 'quota', code: 'quota' },
          }),
          { status: 429, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const provider = new GeminiMentorProvider('fake-key', 'gemini-test-model');
    await expect(
      provider
        .stream(
          {
            message: 'Help',
            history: [],
            context: buildMentorContext({ roadmap: null, plan: null, days: [] }, [], '2026-10-27', {
              name: 'QA learner',
              email: 'qa@example.test',
            }),
          },
          new AbortController().signal,
        )
        .next(),
    ).rejects.toMatchObject({ code: 'MENTOR_QUOTA', statusCode: 429 });
  });
});

describe('shared Gemini application budget', () => {
  it('does not retry roadmap calls after Google exhausts quota', async () => {
    const generate = vi
      .fn()
      .mockRejectedValue(new OpenAI.APIError(429, {}, 'Quota exhausted', new Headers()));
    const sleep = vi.fn();
    expect(await generateValidated({ name: 'gemini', generate }, {}, new Set(), sleep)).toBeNull();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('blocks concurrent calls and more than five attempts per rolling minute', () => {
    let now = 0;
    const budget = new GeminiCallBudget(() => now);
    const release = budget.acquire();
    expect(() => budget.acquire()).toThrow();
    release();
    for (let i = 0; i < 4; i++) budget.acquire()();
    expect(() => budget.acquire()).toThrow();
    now = 60_000;
    expect(() => budget.acquire()()).not.toThrow();
  });

  it('limits attempts to 50 in a rolling day, including failed calls', () => {
    let now = 0;
    const budget = new GeminiCallBudget(() => now);
    for (let i = 0; i < 50; i++) {
      budget.acquire()();
      now += 60_000;
    }
    expect(() => budget.acquire()).toThrow();
    now = 86_400_000;
    expect(() => budget.acquire()()).not.toThrow();
  });

  it('stops new calls for a minute after Google reports exhausted quota', () => {
    let now = 0;
    const budget = new GeminiCallBudget(() => now);
    budget.acquire()();
    budget.quotaExceeded();
    expect(() => budget.acquire()).toThrow();
    now = 60_000;
    expect(() => budget.acquire()()).not.toThrow();
  });
});
