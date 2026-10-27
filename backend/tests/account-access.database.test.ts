import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { getDatabase, disconnectDatabase } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { AccountService, accountTokenHash } from '../src/modules/auth/account.service.js';
import { GoogleService } from '../src/modules/auth/google.service.js';
import type { EmailMessage } from '../src/email/email.provider.js';
import { deliverReminderEmails } from '../src/email/reminders.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'account email and Google persistence',
  () => {
    const db = getDatabase()!;
    const app = createApp({
      authSecrets: { access: 'account-access-'.repeat(4), refresh: 'account-refresh-'.repeat(4) },
    });
    const users: string[] = [];
    afterAll(async () => {
      if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDatabase();
    });
    async function account() {
      const email = `access-${randomUUID()}@example.test`;
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Linkup-Request', '1')
        .send({ name: 'Account QA', email, password: 'LearningTogether!42' });
      expect(response.status).toBe(201);
      users.push(response.body.data.user.id);
      return {
        id: response.body.data.user.id as string,
        token: response.body.data.accessToken as string,
        email,
      };
    }
    const emailToken = (message: EmailMessage) =>
      new URLSearchParams(new URL(message.text.match(/https:\/\/\S+/)![0]).hash.slice(1)).get(
        'token',
      )!;
    it('emails only verified opted-in learners and claims reminder delivery once', async () => {
      const user = await account();
      const messages: EmailMessage[] = [];
      const email = {
        send: async (message: EmailMessage) => {
          messages.push(message);
        },
      };
      const notice = await db.notification.create({
        data: {
          userId: user.id,
          type: 'WEEKLY_REMINDER',
          title: 'Review your plan',
          message: 'Make time to learn.',
          deduplicationKey: randomUUID(),
        },
      });
      await deliverReminderEmails(db, email, 'https://linkup.example');
      expect(messages).toHaveLength(0);
      await db.accountIdentity.create({ data: { userId: user.id, verifiedAt: new Date() } });
      await db.user.update({ where: { id: user.id }, data: { remindersEnabled: false } });
      await deliverReminderEmails(db, email, 'https://linkup.example');
      expect(messages).toHaveLength(0);
      await db.user.update({ where: { id: user.id }, data: { remindersEnabled: true } });
      await Promise.all([
        deliverReminderEmails(db, email, 'https://linkup.example'),
        deliverReminderEmails(db, email, 'https://linkup.example'),
      ]);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.idempotencyKey).toBe(notice.id);
      await deliverReminderEmails(db, email, 'https://linkup.example');
      expect(messages).toHaveLength(1);
      expect(
        (await db.notification.findUniqueOrThrow({ where: { id: notice.id } })).sentAt,
      ).not.toBeNull();
    });
    it('hashes reset links, throttles resends, revokes sessions and consumes links once', async () => {
      const user = await account();
      const messages: EmailMessage[] = [];
      const service = new AccountService(db, 'https://linkup.example', {
        send: async (message) => {
          messages.push(message);
        },
      });
      await service.request(user.email, 'RESET');
      expect(messages).toHaveLength(1);
      const token = emailToken(messages[0]!);
      const stored = await db.accountToken.findFirstOrThrow({ where: { userId: user.id } });
      expect(stored.tokenHash).toBe(accountTokenHash(token));
      expect(stored.tokenHash).not.toBe(token);
      await service.request(user.email, 'RESET');
      await service.request('unknown-' + randomUUID() + '@example.test', 'RESET');
      expect(messages).toHaveLength(1);
      await expect(service.consume(token)).rejects.toMatchObject({ code: 'INVALID_ACCOUNT_TOKEN' });
      const [, racingLogin] = await Promise.all([
        service.consume(token, 'NewLearning!42'),
        request(app)
          .post('/api/v1/auth/login')
          .set('X-Linkup-Request', '1')
          .send({ email: user.email, password: 'LearningTogether!42' }),
      ]);
      expect([200, 401]).toContain(racingLogin.status);
      if (racingLogin.status === 200)
        expect(
          (
            await request(app)
              .get('/api/v1/auth/me')
              .auth(racingLogin.body.data.accessToken, { type: 'bearer' })
          ).status,
        ).toBe(401);
      expect(
        (await request(app).get('/api/v1/auth/me').auth(user.token, { type: 'bearer' })).status,
      ).toBe(401);
      expect(
        (
          await request(app)
            .post('/api/v1/auth/login')
            .set('X-Linkup-Request', '1')
            .send({ email: user.email, password: 'LearningTogether!42' })
        ).status,
      ).toBe(401);
      expect(
        (
          await request(app)
            .post('/api/v1/auth/login')
            .set('X-Linkup-Request', '1')
            .send({ email: user.email, password: 'NewLearning!42' })
        ).status,
      ).toBe(200);
      await expect(service.consume(token, 'AnotherLearning!42')).rejects.toMatchObject({
        code: 'INVALID_ACCOUNT_TOKEN',
      });
      expect((await service.status(user.id)).emailVerified).toBe(true);
    }, 20000);
    it('requires a valid unexpired verification token and handles concurrent consumption atomically', async () => {
      const user = await account();
      const messages: EmailMessage[] = [];
      let now = new Date();
      const service = new AccountService(
        db,
        'https://linkup.example',
        {
          send: async (message) => {
            messages.push(message);
          },
        },
        () => now,
      );
      await service.request(user.email, 'VERIFY', user.id);
      const expired = emailToken(messages[0]!);
      now = new Date(now.getTime() + 25 * 3600000);
      await expect(service.consume(expired)).rejects.toMatchObject({
        code: 'INVALID_ACCOUNT_TOKEN',
      });
      await service.request(user.email, 'VERIFY', user.id);
      const token = emailToken(messages[1]!);
      const results = await Promise.allSettled([service.consume(token), service.consume(token)]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect((await service.status(user.id)).emailVerified).toBe(true);
    });
    it('creates stable Google identities and refuses automatic linking to a password account', async () => {
      const google = new GoogleService(
        db,
        'https://linkup.example',
        'fake-client',
        'fake-secret',
        'state-secret-'.repeat(4),
      );
      const profile = {
        sub: randomUUID(),
        email: `google-${randomUUID()}@example.test`,
        name: 'Google QA',
      };
      const user = await google.identity(profile);
      users.push(user.id);
      expect((await google.identity(profile)).id).toBe(user.id);
      expect(
        (await db.accountIdentity.findUniqueOrThrow({ where: { userId: user.id } })).verifiedAt,
      ).not.toBeNull();
      const passwordUser = await account();
      await expect(
        google.identity({ ...profile, sub: randomUUID(), email: passwordUser.email }),
      ).rejects.toMatchObject({ code: 'GOOGLE_ACCOUNT_EXISTS' });
      expect(
        await db.accountIdentity.findUnique({ where: { userId: passwordUser.id } }),
      ).toBeNull();
    });
  },
);
