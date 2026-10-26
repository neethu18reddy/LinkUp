import { randomUUID } from 'node:crypto';
import { AppError } from '../../src/utils/AppError.js';
import type {
  ChatMessage,
  ChatRepository,
  ChatSession,
  TurnReservation,
} from '../../src/modules/chat/chat.types.js';
import type { MessageInput } from '../../src/modules/chat/chat.schemas.js';
type StoredSession = ChatSession & {
  userId: string;
  token: string | null;
  expires: number;
  messages: ChatMessage[];
};
const publicSession = (row: StoredSession): ChatSession => ({
  id: row.id,
  roadmapId: row.roadmapId,
  title: row.title,
  version: row.version,
  updatedAt: row.updatedAt,
});
export class MemoryChatRepository implements ChatRepository {
  rows = new Map<string, StoredSession>();
  usage = new Map<string, number>();
  private owned(userId: string, id: string) {
    const row = this.rows.get(id);
    if (!row || row.userId !== userId)
      throw new AppError(404, 'CHAT_NOT_FOUND', 'Conversation not found.');
    return row;
  }
  async sessions(userId: string) {
    return [...this.rows.values()].filter((row) => row.userId === userId).map(publicSession);
  }
  async session(userId: string, id: string) {
    return publicSession(this.owned(userId, id));
  }
  async history(userId: string, id: string, limit: number, before?: number) {
    const row = this.owned(userId, id);
    const all = row.messages.filter((message) => before === undefined || message.position < before),
      messages = all.slice(-limit);
    return {
      session: publicSession(row),
      messages,
      nextBefore: all.length > limit ? messages[0]!.position : null,
    };
  }
  async reserve(
    userId: string,
    input: MessageInput,
    roadmapId: string | null,
    now: Date,
  ): Promise<TurnReservation> {
    const id = input.sessionId ?? input.requestId;
    let row = this.rows.get(id);
    if (row && row.userId !== userId)
      throw new AppError(404, 'CHAT_NOT_FOUND', 'Conversation not found.');
    if (!row) {
      if (input.sessionId) throw new AppError(404, 'CHAT_NOT_FOUND', 'Conversation not found.');
      row = {
        id,
        userId,
        roadmapId,
        title: 'Learning roadmap',
        version: 0,
        updatedAt: now.toISOString(),
        token: null,
        expires: 0,
        messages: [],
      };
      this.rows.set(id, row);
    }
    const cached = row.messages.filter((message) => message.requestId === input.requestId);
    if (cached.length) {
      if (cached[0]!.content !== input.message)
        throw new AppError(409, 'CHAT_REQUEST_REUSED', 'Request already saved.');
      return { session: publicSession(row), token: null, cached, history: [] };
    }
    if (row.version !== input.expectedVersion)
      throw new AppError(409, 'HISTORY_CHANGED', 'History changed.');
    if (row.token && row.expires > now.getTime())
      throw new AppError(409, 'CHAT_BUSY', 'A reply is being prepared.');
    const key = `${userId}:${now.toISOString().slice(0, 10)}`,
      used = this.usage.get(key) ?? 0;
    if (used >= 30) throw new AppError(429, 'CHAT_QUOTA', 'Daily mentor quota reached.');
    this.usage.set(key, used + 1);
    row.token = randomUUID();
    row.expires = now.getTime() + 90000;
    return {
      session: publicSession(row),
      token: row.token,
      cached: null,
      history: row.messages.slice(-12),
    };
  }
  async complete(
    userId: string,
    input: MessageInput,
    reservation: TurnReservation,
    content: string,
    mode: string,
  ) {
    const row = this.owned(userId, reservation.session.id);
    if (row.token !== reservation.token || row.version !== reservation.session.version)
      throw new AppError(409, 'CHAT_CHANGED', 'Conversation changed.');
    const messages: ChatMessage[] = [
      {
        id: randomUUID(),
        role: 'USER',
        requestId: input.requestId,
        content: input.message,
        position: row.version,
        mode: 'user',
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        role: 'ASSISTANT',
        requestId: input.requestId,
        content,
        position: row.version + 1,
        mode,
        createdAt: new Date().toISOString(),
      },
    ];
    row.messages.push(...messages);
    row.version += 2;
    row.token = null;
    return { session: publicSession(row), messages };
  }
  async release(userId: string, id: string, token: string) {
    const row = this.rows.get(id);
    if (row?.userId === userId && row.token === token) row.token = null;
  }
  async delete(userId: string, id?: string) {
    if (id) this.owned(userId, id);
    for (const row of this.rows.values())
      if (row.userId === userId && (!id || row.id === id)) this.rows.delete(row.id);
  }
}
