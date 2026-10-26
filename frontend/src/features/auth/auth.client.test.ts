import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authHttp } from '@/lib/http';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { refreshSession, signIn, signOut } from './auth.client';

const session = {
  user: {
    id: 'c08b8c88-e1a7-4ee9-9760-f2ade72183dc',
    name: 'Learner',
    email: 'learner@example.test',
    role: 'USER' as const,
    createdAt: new Date().toISOString(),
  },
  accessToken: 'new-access-token',
  expiresIn: 900,
};
beforeEach(() => {
  vi.restoreAllMocks();
  useAuth.getState().clearSession();
  localStorage.clear();
  sessionStorage.clear();
});

describe('in-memory session client', () => {
  it('deduplicates concurrent refresh requests', async () => {
    const post = vi.spyOn(authHttp, 'post').mockResolvedValue({ data: { data: session } });
    const tokens = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual([session.accessToken, session.accessToken, session.accessToken]);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('does not let an old bootstrap response overwrite a new login', async () => {
    let finish!: (value: unknown) => void;
    const post = vi.spyOn(authHttp, 'post');
    post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const refresh = refreshSession();
    post.mockResolvedValueOnce({
      data: { data: { ...session, accessToken: 'login-access-token' } },
    });
    const login = signIn('login', { email: session.user.email, password: 'Learning!42' });
    finish({ data: { data: session } });
    await Promise.all([refresh, login]);
    expect(useAuth.getState().accessToken).toBe('login-access-token');
  });

  it('clears the local session only after the server confirms logout', async () => {
    useAuth.getState().setSession(session.user, session.accessToken);
    const post = vi
      .spyOn(authHttp, 'post')
      .mockRejectedValueOnce(new AxiosError('Offline', 'ERR_NETWORK'));
    await expect(signOut()).rejects.toThrow();
    expect(useAuth.getState().status).toBe('authenticated');
    post.mockResolvedValue({ data: { success: true } });
    await signOut();
    expect(useAuth.getState().status).toBe('anonymous');
  });

  it('refreshes and retries an expired protected request once', async () => {
    useAuth.getState().setSession(session.user, 'expired-access-token');
    vi.spyOn(authHttp, 'post').mockResolvedValue({ data: { data: session } });
    let calls = 0;
    const response = await api.get('/auth/me', {
      adapter: async (config) => {
        calls++;
        const response = {
          data: { user: session.user },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
        if (calls === 1)
          throw new AxiosError('Expired', 'ERR_BAD_REQUEST', config, undefined, {
            ...response,
            status: 401,
          });
        expect(config.headers.get('Authorization')).toBe(`Bearer ${session.accessToken}`);
        return response;
      },
    });
    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });

  it('does not loop if the retried request is still unauthorized', async () => {
    useAuth.getState().setSession(session.user, 'expired-access-token');
    const post = vi.spyOn(authHttp, 'post').mockResolvedValue({ data: { data: session } });
    let calls = 0;
    await expect(
      api.get('/auth/me', {
        adapter: async (config) => {
          calls++;
          throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
            data: {},
            status: 401,
            statusText: 'Unauthorized',
            headers: {},
            config,
          });
        },
      }),
    ).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2);
    expect(useAuth.getState().status).toBe('anonymous');
  });
});
