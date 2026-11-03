import { AppError } from '../utils/AppError.js';
import type { MentorInput, MentorProvider } from './mentor.provider.js';

// The deadline covers opening the request and consuming its entire stream.
// SDK request timeouts alone do not bound a stalled response body.
async function* attempt(
  provider: MentorProvider,
  input: MentorInput,
  signal: AbortSignal,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const linked = AbortSignal.any([signal, controller.signal]);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let iterator: AsyncIterator<string> | undefined;
  try {
    const active = provider.stream(input, linked)[Symbol.asyncIterator]();
    iterator = active;
    while (true) {
      const next = await new Promise<IteratorResult<string>>((resolve, reject) => {
        const abort = () =>
          reject(
            new AppError(
              signal.aborted ? 408 : 503,
              signal.aborted ? 'CHAT_CANCELLED' : 'MENTOR_UNAVAILABLE',
              signal.aborted ? 'Reply cancelled.' : 'The AI mentor timed out. Please retry.',
            ),
          );
        if (linked.aborted) return abort();
        linked.addEventListener('abort', abort, { once: true });
        active
          .next()
          .then(resolve, reject)
          .finally(() => linked.removeEventListener('abort', abort));
      });
      if (next.done) return;
      yield next.value;
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
    // A non-cooperative provider must not keep the request open during cleanup.
    void Promise.resolve()
      .then(() => iterator?.return?.())
      .catch(() => {});
  }
}

export class FallbackMentorProvider implements MentorProvider {
  readonly mode: string;
  constructor(
    private primary: MentorProvider,
    private fallback?: MentorProvider,
  ) {
    this.mode = primary.mode;
  }

  async *stream(
    input: MentorInput,
    signal: AbortSignal,
    onProviderSelected?: (mode: string) => void,
  ) {
    const providers = [this.primary, ...(this.fallback ? [this.fallback] : [])];
    for (const [index, provider] of providers.entries()) {
      let emitted = false,
        leading = '';
      try {
        if (signal.aborted) throw new AppError(408, 'CHAT_CANCELLED', 'Reply cancelled.');
        for await (const text of attempt(provider, input, signal, index === 0 ? 10000 : 15000)) {
          if (signal.aborted) throw new AppError(408, 'CHAT_CANCELLED', 'Reply cancelled.');
          if (typeof text !== 'string')
            throw new AppError(502, 'MENTOR_OUTPUT_INVALID', 'Invalid mentor reply.');
          if (!emitted) {
            leading += text;
            if (leading.length > 12000)
              throw new AppError(502, 'MENTOR_OUTPUT_INVALID', 'Invalid mentor reply.');
            if (!leading.trim()) continue;
            onProviderSelected?.(provider.mode);
            emitted = true;
            yield leading;
            leading = '';
          } else yield text;
        }
        if (!emitted)
          throw new AppError(502, 'MENTOR_EMPTY', 'No reply was generated. Please retry.');
        return;
      } catch (error) {
        if (signal.aborted) throw new AppError(408, 'CHAT_CANCELLED', 'Reply cancelled.');
        if (emitted || index === providers.length - 1) {
          if (error instanceof AppError) throw error;
          throw new AppError(
            503,
            'MENTOR_UNAVAILABLE',
            'The AI mentor is unavailable. Please retry shortly.',
          );
        }
      }
    }
  }
}
