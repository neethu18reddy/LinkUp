import OpenAI from 'openai';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { mentorInstructions } from './mentor.prompt.js';
import { OfflineMentorProvider, type MentorInput, type MentorProvider } from './mentor.provider.js';

class CompatibleMentorProvider implements MentorProvider {
  private client: OpenAI;
  constructor(
    key: string,
    private model: string,
    client?: OpenAI,
    readonly mode: 'groq' | 'gemini' = 'groq',
  ) {
    this.client =
      client ??
      new OpenAI({
        apiKey: key,
        baseURL:
          mode === 'gemini'
            ? 'https://generativelanguage.googleapis.com/v1beta/openai/'
            : 'https://api.groq.com/openai/v1',
        timeout: 20000,
        maxRetries: 0,
      });
  }
  async *stream(input: MentorInput, signal: AbortSignal) {
    try {
      const stream = await this.client.chat.completions.create(
        {
          model: this.model,
          stream: true,
          temperature: 0.4,
          ...(this.mode === 'gemini'
            ? { max_tokens: 1800, reasoning_effort: 'low' as const }
            : { max_completion_tokens: 1800 }),
          messages: [
            {
              role: 'system',
              content: mentorInstructions,
            },
            {
              role: 'system',
              content: `Anonymised learning context: ${JSON.stringify(input.context)}`,
            },
            ...input.history.map((message) => ({
              role: message.role === 'USER' ? ('user' as const) : ('assistant' as const),
              content: message.content,
            })),
            { role: 'user', content: input.message },
          ],
        },
        { signal },
      );
      for await (const chunk of stream) {
        if (signal.aborted) throw new Error('cancelled');
        const text = chunk.choices[0]?.delta.content;
        if (text) yield text;
      }
    } catch (error) {
      if (!signal.aborted && error instanceof OpenAI.APIError) {
        if (error.status === 429)
          throw new AppError(
            429,
            'MENTOR_QUOTA',
            'The AI provider has reached its usage limit. Wait before retrying; if this continues, the owner needs to check the provider quota.',
          );
        if (error.status === 401 || error.status === 403)
          throw new AppError(
            503,
            'MENTOR_CONFIGURATION',
            'The AI provider could not authorize this request. The owner needs to check the API key and model access.',
          );
        if (error.status === 400 || error.status === 404)
          throw new AppError(
            503,
            'MENTOR_CONFIGURATION',
            'The configured AI model could not accept this request. The owner needs to check the model configuration.',
          );
      }
      throw new AppError(
        signal.aborted ? 408 : 503,
        signal.aborted ? 'CHAT_CANCELLED' : 'MENTOR_UNAVAILABLE',
        signal.aborted
          ? 'Reply cancelled.'
          : 'The AI mentor is unavailable. Please retry shortly or review your roadmap resources.',
      );
    }
  }
}

export class GroqMentorProvider extends CompatibleMentorProvider {}

export class GeminiMentorProvider extends CompatibleMentorProvider {
  constructor(key: string, model: string, client?: OpenAI) {
    super(key, model, client, 'gemini');
  }
}

export function configuredMentorProvider(): MentorProvider {
  if (env.LLM_PROVIDER === 'disabled' || !env.LLM_LIVE_CALLS_APPROVED)
    return new OfflineMentorProvider();
  if (env.LLM_PROVIDER === 'gemini') {
    if (!env.GEMINI_API_KEY || !env.LLM_MODEL)
      throw new Error('Approved Gemini requires a key and model.');
    return new GeminiMentorProvider(env.GEMINI_API_KEY, env.LLM_MODEL);
  }
  if (!env.GROQ_API_KEY || !env.LLM_MODEL)
    throw new Error('Approved Groq requires a key and model.');
  return new GroqMentorProvider(env.GROQ_API_KEY, env.LLM_MODEL);
}
