import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../config/database.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { isTransactionConflict } from '../../utils/transactionConflict.js';
import type { MessageInput } from './chat.schemas.js';
import type { ChatRepository, TurnReservation } from './chat.types.js';

const include = { roadmap: { select: { title: true } } };
function publicSession(row: Prisma.ChatSessionGetPayload<{ include: typeof include }>) {
  return {
    id: row.id,
    roadmapId: row.roadmapId,
    title: row.roadmap?.title ?? 'General learning',
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}
function publicMessage(row: Prisma.ChatMessageGetPayload<Record<string, never>>) {
  return { ...row, createdAt: row.createdAt.toISOString() };
}
function database() {
  const db = getDatabase();
  if (!db) throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'The database is not configured.');
  return db;
}
async function transaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++)
    try {
      return await database().$transaction(action, {
        isolationLevel: 'Serializable',
        timeout: 15000,
      });
    } catch (error) {
      if (isTransactionConflict(error)) {
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
          continue;
        }
        throw new AppError(503, 'CHAT_BUSY', 'Your conversation is being updated. Retry shortly.');
      }
      throw error;
    }
}
async function ownedSession(tx: Prisma.TransactionClient, userId: string, id: string) {
  const session = await tx.chatSession.findFirst({ where: { id, userId }, include });
  if (!session) throw new AppError(404, 'CHAT_NOT_FOUND', 'Conversation not found.');
  return session;
}
export class PrismaChatRepository implements ChatRepository {
  async sessions(userId: string) {
    return (
      await database().chatSession.findMany({
        where: { userId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 20,
        include,
      })
    ).map(publicSession);
  }
  async session(userId: string, id: string) {
    return publicSession(await ownedSession(database(), userId, id));
  }
  async history(userId: string, id: string, limit: number, before?: number) {
    return database().$transaction(
      async (tx) => {
        const session = await ownedSession(tx, userId, id);
        const rows = await tx.chatMessage.findMany({
          where: { sessionId: id, ...(before !== undefined ? { position: { lt: before } } : {}) },
          orderBy: { position: 'desc' },
          take: limit + 1,
        });
        const messages = rows.slice(0, limit).reverse().map(publicMessage);
        return {
          session: publicSession(session),
          messages,
          nextBefore: rows.length > limit ? messages[0]!.position : null,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async reserve(
    userId: string,
    input: MessageInput,
    roadmapId: string | null,
    now: Date,
  ): Promise<TurnReservation> {
    return transaction(async (tx) => {
      const id = input.sessionId ?? input.requestId;
      let session = await tx.chatSession.findUnique({ where: { id }, include });
      if (session && session.userId !== userId)
        throw new AppError(404, 'CHAT_NOT_FOUND', 'Conversation not found.');
      if (!session) {
        if (input.sessionId) throw new AppError(404, 'CHAT_NOT_FOUND', 'Conversation not found.');
        if (
          roadmapId &&
          !(await tx.roadmap.findFirst({ where: { id: roadmapId, userId }, select: { id: true } }))
        )
          throw new AppError(404, 'ROADMAP_NOT_FOUND', 'Roadmap not found.');
        session = await tx.chatSession.create({ data: { id, userId, roadmapId }, include });
      }
      const cached = await tx.chatMessage.findMany({
        where: { sessionId: id, requestId: input.requestId },
        orderBy: { position: 'asc' },
      });
      if (cached.length) {
        if (cached.length !== 2 || cached[0]!.content !== input.message)
          throw new AppError(
            409,
            'CHAT_REQUEST_REUSED',
            'This request already has different saved content.',
          );
        return {
          session: publicSession(session),
          token: null,
          cached: cached.map(publicMessage),
          history: [],
        };
      }
      if (session.version !== input.expectedVersion)
        throw new AppError(
          409,
          'HISTORY_CHANGED',
          'This conversation changed. Load its latest messages before sending again.',
        );
      if (session.busyToken && session.busyUntil && session.busyUntil > now)
        throw new AppError(
          409,
          'CHAT_BUSY',
          'A reply is already being prepared. Wait or retry shortly.',
        );
      const date = new Date(now);
      date.setUTCHours(0, 0, 0, 0);
      await tx.dailyUsage.upsert({
        where: { userId_date_kind: { userId, date, kind: 'CHAT' } },
        create: { userId, date, kind: 'CHAT', count: 0 },
        update: {},
      });
      const usage = await tx.dailyUsage.updateMany({
        where: { userId, date, kind: 'CHAT', count: { lt: 30 } },
        data: { count: { increment: 1 } },
      });
      if (!usage.count)
        throw new AppError(
          429,
          'CHAT_QUOTA',
          'You have used your 30 mentor attempts today. Try again tomorrow (UTC).',
        );
      const token = randomUUID();
      session = await tx.chatSession.update({
        where: { id },
        data: { busyToken: token, busyUntil: new Date(now.getTime() + 90000) },
        include,
      });
      const history = (
        await tx.chatMessage.findMany({
          where: { sessionId: id },
          orderBy: { position: 'desc' },
          take: 12,
        })
      )
        .reverse()
        .map(publicMessage);
      return { session: publicSession(session), token, cached: null, history };
    });
  }
  async complete(
    userId: string,
    input: MessageInput,
    reservation: TurnReservation,
    content: string,
    mode: string,
  ) {
    return transaction(async (tx) => {
      const current = await ownedSession(tx, userId, reservation.session.id);
      if (
        current.busyToken !== reservation.token ||
        current.version !== reservation.session.version ||
        !current.busyUntil ||
        current.busyUntil < new Date()
      )
        throw new AppError(
          409,
          'CHAT_CHANGED',
          'This conversation changed while preparing a reply. Load its history and retry.',
        );
      await tx.chatMessage.createMany({
        data: [
          {
            sessionId: current.id,
            requestId: input.requestId,
            position: current.version,
            role: 'USER',
            content: input.message,
            mode: 'user',
          },
          {
            sessionId: current.id,
            requestId: input.requestId,
            position: current.version + 1,
            role: 'ASSISTANT',
            content,
            mode,
          },
        ],
      });
      const session = await tx.chatSession.update({
        where: { id: current.id },
        data: { version: { increment: 2 }, busyToken: null, busyUntil: null },
        include,
      });
      const messages = (
        await tx.chatMessage.findMany({
          where: { sessionId: current.id, requestId: input.requestId },
          orderBy: { position: 'asc' },
        })
      ).map(publicMessage);
      return { session: publicSession(session), messages };
    });
  }
  async release(userId: string, sessionId: string, token: string) {
    await database().chatSession.updateMany({
      where: { id: sessionId, userId, busyToken: token },
      data: { busyToken: null, busyUntil: null },
    });
  }
  async delete(userId: string, sessionId?: string) {
    await transaction(async (tx) => {
      if (sessionId) await ownedSession(tx, userId, sessionId);
      await tx.chatSession.deleteMany({
        where: { userId, ...(sessionId ? { id: sessionId } : {}) },
      });
    });
  }
}
