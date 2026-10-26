import axios from 'axios';
import { z } from 'zod';
import { authHttp, requestError } from '@/lib/http';
import { useAuth } from '@/store/auth';

const sessionSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().positive(),
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    role: z.enum(['USER', 'ADMIN']),
    createdAt: z.iso.datetime(),
  }),
});
let generation = 0;
let refreshing: Promise<string | null> | null = null;

async function sessionLock<T>(action: () => Promise<T>): Promise<T> {
  // Prevent separate tabs from presenting the same rotating cookie concurrently.
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request('linkup-session', action);
  return action();
}

export function refreshSession(): Promise<string | null> {
  if (refreshing) return refreshing;
  const startedAt = generation;
  refreshing = sessionLock(async () => {
    try {
      const response = await authHttp.post('/auth/refresh', {});
      const session = sessionSchema.parse(response.data.data);
      if (startedAt !== generation) return useAuth.getState().accessToken;
      useAuth.getState().setSession(session.user, session.accessToken);
      return session.accessToken;
    } catch (error) {
      if (startedAt !== generation) return useAuth.getState().accessToken;
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        useAuth.getState().clearSession();
        return null;
      }
      useAuth.getState().setError(requestError(error));
      throw error;
    }
  }).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function signIn(
  mode: 'login' | 'register',
  input: { email: string; password: string; name?: string },
) {
  const startedAt = ++generation;
  return sessionLock(async () => {
    const response = await authHttp.post(`/auth/${mode}`, input);
    const session = sessionSchema.parse(response.data.data);
    if (startedAt === generation) useAuth.getState().setSession(session.user, session.accessToken);
    return session;
  });
}

export async function signOut() {
  await sessionLock(async () => {
    await authHttp.post('/auth/logout', {});
  });
  clearLocalSession();
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('linkup-session');
    channel.postMessage('signed-out');
    channel.close();
  }
}

export function clearLocalSession() {
  generation++;
  useAuth.getState().clearSession();
}
