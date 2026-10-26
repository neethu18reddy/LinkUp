import { AppError } from '../../utils/AppError.js';
import {
  buildMentorContext,
  redactMentorText,
  trimMentorHistory,
} from '../../ai/mentor.context.js';
import { OfflineMentorProvider, type MentorProvider } from '../../ai/mentor.provider.js';
import type { PublicUser } from '../auth/auth.types.js';
import type { ProgressRepository } from '../progress/progress.types.js';
import type { SkillsRepository } from '../skills/skills.types.js';
import type { MessageInput } from './chat.schemas.js';
import type { ChatRepository, TurnReservation } from './chat.types.js';

export class ChatService {
  constructor(
    private repository: ChatRepository,
    private progress: ProgressRepository,
    private skills: SkillsRepository,
    private provider: MentorProvider = new OfflineMentorProvider(),
  ) {}
  sessions(userId: string) {
    return this.repository.sessions(userId);
  }
  history(userId: string, id: string, limit: number, before?: number) {
    return this.repository.history(userId, id, limit, before);
  }
  delete(userId: string, id?: string) {
    return this.repository.delete(userId, id);
  }
  async prepare(user: PublicUser, input: MessageInput) {
    const session = input.sessionId
      ? await this.repository.session(user.id, input.sessionId)
      : null;
    const now = new Date();
    const [snapshot, profile] = await Promise.all([
      this.progress.snapshot(user.id, session?.roadmapId ?? undefined, now),
      this.skills.listProfile(user.id),
    ]);
    const context = buildMentorContext(snapshot, profile, now.toISOString().slice(0, 10), user);
    const reservation = await this.repository.reserve(
      user.id,
      input,
      snapshot.roadmap?.id ?? null,
      now,
    );
    const message = redactMentorText(input.message, user);
    const budget = Math.max(
      0,
      Math.min(8000, 12000 - JSON.stringify(context).length - message.length),
    );
    return {
      reservation,
      providerInput: {
        message,
        context,
        history: trimMentorHistory(reservation.history, user, budget),
      },
    };
  }
  async *reply(
    userId: string,
    input: MessageInput,
    prepared: Awaited<ReturnType<ChatService['prepare']>>,
    signal: AbortSignal,
  ) {
    const { reservation, providerInput } = prepared;
    try {
      yield {
        event: 'meta',
        data: {
          session: reservation.session,
          mode: reservation.cached?.[1]?.mode ?? this.provider.mode,
        },
      };
      if (reservation.cached) {
        yield { event: 'delta', data: { text: reservation.cached[1]!.content } };
        yield {
          event: 'done',
          data: { session: reservation.session, messages: reservation.cached },
        };
        return;
      }
      const iterator = this.provider.stream(providerInput, signal)[Symbol.asyncIterator]();
      let content = '',
        finished = false;
      try {
        while (true) {
          if (signal.aborted) throw new AppError(408, 'CHAT_CANCELLED', 'Reply cancelled.');
          const result = await nextChunk(iterator, signal);
          if (result.done) {
            finished = true;
            break;
          }
          if (typeof result.value !== 'string' || content.length + result.value.length > 12000)
            throw new AppError(
              502,
              'MENTOR_OUTPUT_INVALID',
              'The mentor reply was too long. Try a shorter question.',
            );
          content += result.value;
          yield { event: 'delta', data: { text: result.value } };
        }
      } finally {
        if (!finished) void iterator.return?.().catch(() => {});
      }
      if (!content.trim())
        throw new AppError(502, 'MENTOR_EMPTY', 'No reply was generated. Please retry.');
      if (signal.aborted) throw new AppError(408, 'CHAT_CANCELLED', 'Reply cancelled.');
      const saved = await this.repository.complete(
        userId,
        input,
        reservation,
        content,
        this.provider.mode,
      );
      yield { event: 'done', data: saved };
    } finally {
      await this.release(userId, reservation);
    }
  }
  async release(userId: string, reservation: TurnReservation) {
    if (reservation.token)
      await this.repository.release(userId, reservation.session.id, reservation.token);
  }
}
function nextChunk(
  iterator: AsyncIterator<string>,
  signal: AbortSignal,
): Promise<IteratorResult<string>> {
  return new Promise((resolve, reject) => {
    const abort = () =>
      reject(new AppError(408, 'CHAT_CANCELLED', 'Reply cancelled or timed out.'));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    iterator
      .next()
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}
