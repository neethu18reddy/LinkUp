import OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { GroqMentorProvider, configuredMentorProvider } from '../src/ai/mentor.groq.js';
import { buildMentorContext } from '../src/ai/mentor.context.js';

const input = {
  message: 'Explain loops with a small exercise.',
  context: buildMentorContext({ roadmap: null, plan: null, days: [] }, [], '2026-10-27', {
    name: 'Private learner',
    email: 'private@example.test',
  }),
  history: [{ role: 'USER' as const, content: 'I am learning Python.' }],
};
describe('approved Groq mentor transport', () => {
  it('keeps test/default configurations offline', () => {
    expect(configuredMentorProvider().mode).toBe('offline');
  });
  it('streams text with bounded context and forwards cancellation without network access in tests', async () => {
    const create = vi.fn().mockResolvedValue(
      (async function* () {
        yield { choices: [{ delta: { content: 'A loop ' } }] };
        yield { choices: [{ delta: { content: 'repeats work.' } }] };
      })(),
    );
    const client = { chat: { completions: { create } } } as unknown as OpenAI;
    const provider = new GroqMentorProvider('fake-key', 'test-model', client);
    const signal = new AbortController().signal;
    const chunks = [];
    for await (const chunk of provider.stream(input, signal)) chunks.push(chunk);
    expect(chunks.join('')).toBe('A loop repeats work.');
    expect(create.mock.calls[0]![1]).toEqual({ signal });
    expect(create.mock.calls[0]![0]).toMatchObject({
      model: 'test-model',
      stream: true,
      max_completion_tokens: 1800,
    });
    expect(JSON.stringify(create.mock.calls[0]![0].messages)).not.toContain('private@example.test');
    expect(create.mock.calls[0]![0].messages.at(-1).content).toBe(input.message);
    expect(create.mock.calls[0]![0].messages[0].content).toContain(
      "Answer the learner's latest question first",
    );
    expect(create.mock.calls[0]![0].messages[0].content).toContain('ask ONE question at a time');
    expect(create.mock.calls[0]![0].messages).toContainEqual({
      role: 'user',
      content: 'I am learning Python.',
    });
  });
  it('returns a safe error instead of exposing provider credentials or internal failures', async () => {
    const create = vi.fn().mockRejectedValue(new Error('secret provider diagnostics'));
    const provider = new GroqMentorProvider('fake-key', 'test-model', {
      chat: { completions: { create } },
    } as unknown as OpenAI);
    await expect(provider.stream(input, new AbortController().signal).next()).rejects.toMatchObject(
      { statusCode: 503, code: 'MENTOR_UNAVAILABLE' },
    );
  });
  it('reports cancellation without saving it as a successful reply', async () => {
    const controller = new AbortController();
    controller.abort();
    const create = vi.fn().mockRejectedValue(new Error('aborted'));
    const provider = new GroqMentorProvider('fake-key', 'test-model', {
      chat: { completions: { create } },
    } as unknown as OpenAI);
    await expect(provider.stream(input, controller.signal).next()).rejects.toMatchObject({
      statusCode: 408,
      code: 'CHAT_CANCELLED',
    });
  });
});
