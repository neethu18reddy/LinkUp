import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { GoogleService, googleProfileSchema } from '../src/modules/auth/google.service.js';
import { BrevoEmailProvider, configuredEmailProvider } from '../src/email/email.provider.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';

describe('account provider guards', () => {
  it('creates PKCE/state-bound Google requests and rejects missing or mismatched cookies before a network call', async () => {
    const service = new GoogleService(
      {} as PrismaClient,
      'https://linkup.example',
      'fake-client',
      'fake-secret',
      'state-secret-'.repeat(4),
    );
    const result = await service.start();
    const url = new URL(result.url);
    const state = url.searchParams.get('state')!;
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://linkup.example/api/v1/auth/google/callback',
    );
    expect(service.readState(result.cookie, state).nonce).toBe(url.searchParams.get('nonce'));
    expect(() => service.readState(result.cookie, 'wrong-state')).toThrow('expired');
    await expect(service.complete(undefined, state, 'unused-code')).rejects.toMatchObject({
      code: 'GOOGLE_STATE_INVALID',
    });
    expect(
      googleProfileSchema.safeParse({
        sub: 'test',
        email: 'user@example.test',
        email_verified: false,
        nonce: 'test',
      }).success,
    ).toBe(false);
  });
  it('sends plain transactional email only to the fixed provider and hides provider diagnostics', async () => {
    const transport = vi.fn().mockResolvedValue({ ok: true });
    const email = new BrevoEmailProvider('fake-private-key', 'sender@example.test', transport);
    await email.send({
      to: 'recipient@example.test',
      subject: 'Verify email',
      text: 'A private link',
      idempotencyKey: 'unique-test',
    });
    expect(transport.mock.calls[0]![0]).toBe('https://api.brevo.com/v3/smtp/email');
    expect(JSON.parse(transport.mock.calls[0]![1].body)).toMatchObject({
      textContent: 'A private link',
      to: [{ email: 'recipient@example.test' }],
    });
    transport.mockRejectedValue(new Error('fake-private-key diagnostics'));
    await expect(
      email.send({
        to: 'recipient@example.test',
        subject: 'Test',
        text: 'Test',
        idempotencyKey: 'test',
      }),
    ).rejects.toMatchObject({
      code: 'EMAIL_UNAVAILABLE',
      message: 'Email delivery is temporarily unavailable. Please retry later.',
    });
  });
  it('keeps integrations off by default and rejects incomplete approved configuration', () => {
    expect(configuredEmailProvider()).toBeUndefined();
    expect(() => parseEnv({ EMAIL_PROVIDER: 'brevo', EMAIL_LIVE_CALLS_APPROVED: 'true' })).toThrow(
      'BREVO_API_KEY',
    );
    expect(() => parseEnv({ GOOGLE_OAUTH_ENABLED: 'true' })).toThrow('GOOGLE_CLIENT_ID');
  });
  it('exposes only feature flags and safely handles unconfigured email, Google and scheduled jobs', async () => {
    const app = createApp();
    expect((await request(app).get('/api/v1/auth/options')).body.data).toMatchObject({
      googleEnabled: false,
      emailEnabled: false,
    });
    expect(
      (
        await request(app)
          .post('/api/v1/auth/forgot-password')
          .set('X-Linkup-Request', '1')
          .send({ email: 'test@example.test' })
      ).status,
    ).toBe(503);
    expect((await request(app).get('/api/v1/auth/google/start')).status).toBe(503);
    expect((await request(app).get('/api/v1/internal/jobs/daily')).status).toBe(503);
  });
});
