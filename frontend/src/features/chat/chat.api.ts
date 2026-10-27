import { z } from 'zod';
import { api } from '@/lib/api';
import { httpOptions } from '@/lib/http';
import { useAuth } from '@/store/auth';
import { refreshSession, clearLocalSession } from '@/features/auth/auth.client';
export const sessionSchema = z.object({
  id: z.uuid(),
  roadmapId: z.uuid().nullable(),
  title: z.string(),
  version: z.number().int(),
  updatedAt: z.iso.datetime(),
});
export const chatMessageSchema = z.object({
  id: z.uuid(),
  role: z.enum(['USER', 'ASSISTANT']),
  content: z.string(),
  requestId: z.uuid(),
  position: z.number().int(),
  mode: z.string(),
  createdAt: z.iso.datetime(),
});
export const historyPageSchema = z.object({
  session: sessionSchema,
  messages: z.array(chatMessageSchema),
  nextBefore: z.number().int().nullable(),
});
export type ChatSession = z.infer<typeof sessionSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type HistoryPage = z.infer<typeof historyPageSchema>;
export interface MessageInput {
  sessionId: string | null;
  requestId: string;
  expectedVersion: number;
  message: string;
}
const eventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('meta'),
    data: z.object({ session: sessionSchema, mode: z.string() }),
  }),
  z.object({ event: z.literal('delta'), data: z.object({ text: z.string().max(12000) }) }),
  z.object({
    event: z.literal('done'),
    data: z.object({ session: sessionSchema, messages: z.array(chatMessageSchema).length(2) }),
  }),
  z.object({
    event: z.literal('error'),
    data: z.object({ code: z.string(), message: z.string() }),
  }),
]);
export type MentorEvent = z.infer<typeof eventSchema>;
export class MentorError extends Error {}
export const sessionsKey = ['mentor-sessions'] as const;
export async function getMentorConfig() {
  return z.object({ mode: z.string() }).parse((await api.get('/chat/config')).data.data);
}
export const historyKey = (id: string) => ['mentor-history', id] as const;
export async function getSessions() {
  return z.array(sessionSchema).parse((await api.get('/chat/sessions')).data.data.sessions);
}
export async function getHistory(id: string, before?: number) {
  return historyPageSchema.parse(
    (
      await api.get('/chat/history', {
        params: { sessionId: id, limit: 40, ...(before ? { before } : {}) },
      })
    ).data.data,
  );
}
export async function deleteHistory(sessionId: string) {
  await api.delete('/chat/history', { data: { sessionId } });
}
export async function readMentorEvents(response: Response, onEvent: (event: MentorEvent) => void) {
  if (!response.body) throw new MentorError('Streaming is unavailable. Please retry.');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = '',
    done = false,
    total = 0;
  try {
    while (!done) {
      const part = await reader.read();
      buffer += decoder.decode(part.value, { stream: !part.done });
      if (buffer.length > 64000)
        throw new MentorError('The reply frame was too large. Please retry.');
      let boundary: RegExpMatchArray | null;
      while ((boundary = buffer.match(/\r?\n\r?\n/))) {
        const frame = buffer.slice(0, boundary.index),
          rest = buffer.slice(boundary.index! + boundary[0].length);
        buffer = rest;
        let event = 'message';
        const data: string[] = [];
        for (const line of frame.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
        }
        if (!data.length) continue;
        let parsed: MentorEvent;
        try {
          parsed = eventSchema.parse({ event, data: JSON.parse(data.join('\n')) });
        } catch {
          throw new MentorError('The mentor returned an invalid response. Please retry.');
        }
        if (parsed.event === 'error') throw new MentorError(parsed.data.message);
        if (parsed.event === 'delta') {
          total += parsed.data.text.length;
          if (total > 12000) throw new MentorError('The reply was too long. Please retry.');
        }
        onEvent(parsed);
        if (parsed.event === 'done') {
          done = true;
          break;
        }
      }
      if (part.done) break;
    }
    if (!done) throw new MentorError('The reply ended before it was saved. Retry to recover it.');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function streamMessage(
  input: MessageInput,
  signal: AbortSignal,
  onEvent: (event: MentorEvent) => void,
) {
  const owner = useAuth.getState().user?.id;
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 45000);
  const combined = AbortSignal.any([signal, controller.signal]);
  const request = () => {
    const token = useAuth.getState().accessToken;
    if (!token || useAuth.getState().user?.id !== owner)
      throw new MentorError('Your session changed. Sign in again.');
    return fetch(`${httpOptions.baseURL.replace(/\/$/, '')}/chat/message`, {
      method: 'POST',
      credentials: 'include',
      signal: combined,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-Linkup-Request': '1',
      },
      body: JSON.stringify(input),
    });
  };
  try {
    let response = await request();
    if (response.status === 401) {
      await response.body?.cancel();
      await refreshSession();
      response = await request();
      if (response.status === 401) clearLocalSession();
    }
    if (!response.ok) {
      let message = 'The mentor could not respond. Please retry.';
      try {
        const body = await response.json();
        if (typeof body.error?.message === 'string') message = body.error.message;
      } catch {
        /* Do not expose raw server responses. */
      }
      throw new MentorError(message);
    }
    if (!response.headers.get('content-type')?.includes('text/event-stream'))
      throw new MentorError('Streaming is unavailable. Please retry.');
    await readMentorEvents(response, (event) => {
      if (useAuth.getState().user?.id !== owner) throw new MentorError('Your session changed.');
      onEvent(event);
    });
  } finally {
    clearTimeout(timeout);
  }
}
