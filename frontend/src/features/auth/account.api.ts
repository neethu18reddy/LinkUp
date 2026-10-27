import { z } from 'zod';
import { api } from '@/lib/api';
import { authHttp } from '@/lib/http';

export async function getAuthOptions() {
  return z
    .object({ googleEnabled: z.boolean(), emailEnabled: z.boolean(), mentorMode: z.string() })
    .parse((await authHttp.get('/auth/options')).data.data);
}
export async function accountStatus() {
  return z
    .object({ emailVerified: z.boolean(), googleLinked: z.boolean(), emailEnabled: z.boolean() })
    .parse((await api.get('/account/status')).data.data);
}
export async function requestVerification() {
  return (await api.post('/auth/request-verification', {})).data.data.message as string;
}
export async function recoverAccount(mode: 'forgot' | 'reset' | 'verify', input: object) {
  const path =
    mode === 'forgot' ? 'forgot-password' : mode === 'reset' ? 'reset-password' : 'verify-email';
  return z
    .object({ message: z.string() })
    .parse((await authHttp.post(`/auth/${path}`, input)).data.data).message;
}
