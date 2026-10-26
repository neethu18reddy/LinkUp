import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { WeeklyJob, matchesCronSecret } from '../src/jobs/weekly.js';
import {
  utcWeek,
  reminderContent,
  type ReminderWeek,
} from '../src/modules/notifications/notifications.logic.js';
import type { NotificationRepository } from '../src/modules/notifications/notifications.types.js';
import { MemoryAuthRepository } from './helpers/memory-auth-repository.js';
const now = new Date('2026-10-27T08:00:00.000Z');
function repository(): NotificationRepository {
  return {
    list: vi.fn().mockResolvedValue({ notifications: [], unreadCount: 0, nextCursor: null }),
    read: vi.fn(),
    preferences: vi.fn().mockResolvedValue({ remindersEnabled: true }),
    setPreferences: vi.fn().mockResolvedValue({ remindersEnabled: false }),
    weekly: vi.fn().mockResolvedValue({ processed: 1, created: 1, nextCursor: null }),
  };
}
const secret = 'test-cron-secret-'.repeat(4);
describe('reminder rules', () => {
  it('uses Monday UTC across year and Sunday boundaries', () => {
    expect(utcWeek(new Date('2027-01-03T23:59:59Z'))).toBe('2026-12-28');
    expect(utcWeek(new Date('2027-01-04T00:00:00Z'))).toBe('2027-01-04');
  });
  it('does not remind empty, completed or future-only plans', () => {
    expect(reminderContent([], now)).toEqual([]);
    expect(
      reminderContent(
        [
          {
            startDate: '2026-11-01',
            items: [{ status: 'TODO', topicDone: false, allocatedHours: 2 }],
          },
        ],
        now,
      ),
    ).toEqual([]);
    expect(
      reminderContent(
        [
          {
            startDate: '2026-10-20',
            items: [
              { status: 'DONE', topicDone: false, allocatedHours: 2 },
              { status: 'TODO', topicDone: true, allocatedHours: 3 },
            ],
          },
        ],
        now,
      ),
    ).toEqual([]);
  });
  it('waits until a full plan week has ended before marking work overdue', () => {
    const weeks: ReminderWeek[] = [
      {
        startDate: '2026-10-20',
        items: [
          { status: 'SKIPPED', topicDone: false, allocatedHours: 1.25 },
          { status: 'DONE', topicDone: false, allocatedHours: 5 },
        ],
      },
    ];
    expect(reminderContent(weeks, new Date('2026-10-26T23:59:59Z'))).toHaveLength(1);
    const notices = reminderContent(weeks, now);
    expect(notices.map((row) => row.type)).toEqual(['WEEKLY_REMINDER', 'BEHIND_SCHEDULE']);
    expect(notices[1]!.message).toContain('1.25 planned hours');
  });
  it('checks the whole secret, including length and missing configuration', () => {
    expect(matchesCronSecret(secret, secret)).toBe(true);
    expect(matchesCronSecret(secret + 'x', secret)).toBe(false);
    expect(matchesCronSecret(undefined, secret)).toBe(false);
    expect(matchesCronSecret(secret, undefined)).toBe(false);
  });
  it('rejects overlapping batches and releases the guard after failure', async () => {
    const repo = repository();
    let reject!: (reason: Error) => void;
    vi.mocked(repo.weekly).mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const job = new WeeklyJob(repo, () => now);
    const first = job.run();
    await expect(job.run()).rejects.toMatchObject({ code: 'JOB_BUSY' });
    reject(new Error('database unavailable'));
    await expect(first).rejects.toThrow('database unavailable');
    await expect(job.run()).resolves.toMatchObject({ created: 1 });
  });
});
describe('notification API', () => {
  function appFixture(cronSecret = secret) {
    const repo = repository();
    const app = createApp({
      notificationRepository: repo,
      cronSecret,
      authRepository: new MemoryAuthRepository(),
      authSecrets: { access: 'notice-access-'.repeat(4), refresh: 'notice-refresh-'.repeat(4) },
    });
    return { app, repo };
  }
  it('requires a separate job secret and rejects unvalidated batch inputs', async () => {
    const { app, repo } = appFixture();
    expect((await request(app).post('/api/v1/internal/jobs/weekly').send({})).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/internal/jobs/weekly')
          .set('Authorization', secret)
          .send({})
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/internal/jobs/weekly')
          .auth('wrong', { type: 'bearer' })
          .send({})
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/internal/jobs/weekly')
          .auth(secret, { type: 'bearer' })
          .send({ now: '2099-01-01' })
      ).status,
    ).toBe(422);
    expect(repo.weekly).not.toHaveBeenCalled();
    const cursor = randomUUID();
    expect(
      (
        await request(app)
          .post('/api/v1/internal/jobs/weekly')
          .auth(secret, { type: 'bearer' })
          .send({ cursor })
      ).status,
    ).toBe(200);
    expect(repo.weekly).toHaveBeenCalledWith(expect.any(Date), cursor);
  });
  it('disables remote jobs without a configured secret', async () => {
    const { app, repo } = appFixture('');
    expect(
      (
        await request(app)
          .post('/api/v1/internal/jobs/weekly')
          .auth(secret, { type: 'bearer' })
          .send({})
      ).status,
    ).toBe(503);
    expect(repo.weekly).not.toHaveBeenCalled();
  });
  it('requires auth, scopes inbox/preferences/read to the authenticated account', async () => {
    const { app, repo } = appFixture();
    expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
    const registration = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Linkup-Request', '1')
      .send({
        name: 'Notice user',
        email: 'notices@example.test',
        password: 'LearningTogether!42',
      });
    expect(registration.status).toBe(201);
    const { accessToken, user } = registration.body.data;
    const inbox = await request(app)
      .get('/api/v1/notifications')
      .auth(accessToken, { type: 'bearer' });
    expect(inbox.status).toBe(200);
    expect(inbox.headers['cache-control']).toBe('no-store');
    expect(repo.list).toHaveBeenCalledWith(user.id, undefined);
    expect(
      (
        await request(app)
          .patch('/api/v1/notifications/preferences')
          .auth(accessToken, { type: 'bearer' })
          .send({ remindersEnabled: false, userId: randomUUID() })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .patch('/api/v1/notifications/preferences')
          .auth(accessToken, { type: 'bearer' })
          .send({ remindersEnabled: false })
      ).status,
    ).toBe(200);
    expect(repo.setPreferences).toHaveBeenCalledWith(user.id, false);
    const id = randomUUID();
    expect(
      (
        await request(app)
          .patch(`/api/v1/notifications/${id}/read`)
          .auth(accessToken, { type: 'bearer' })
          .send({})
      ).status,
    ).toBe(200);
    expect(repo.read).toHaveBeenCalledWith(user.id, id, expect.any(Date));
    expect(
      (
        await request(app)
          .get('/api/v1/notifications?cursor=invalid')
          .auth(accessToken, { type: 'bearer' })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .post('/api/v1/internal/jobs/weekly')
          .auth(accessToken, { type: 'bearer' })
          .send({})
      ).status,
    ).toBe(401);
  });
});
