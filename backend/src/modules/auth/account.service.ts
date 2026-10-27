import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { EmailProvider } from '../../email/email.provider.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';

const invalidToken = () =>
  new AppError(
    400,
    'INVALID_ACCOUNT_TOKEN',
    'This link has expired or already been used. Request a new link.',
  );
export const accountTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export class AccountService {
  constructor(
    private db: PrismaClient,
    private origin: string,
    private email?: EmailProvider,
    private clock = () => new Date(),
  ) {}
  async status(userId: string) {
    const identity = await this.db.accountIdentity.findUnique({ where: { userId } });
    return {
      emailVerified: !!identity?.verifiedAt,
      googleLinked: !!identity?.googleSubject,
      emailEnabled: !!this.email,
    };
  }
  private async issue(userId: string, kind: 'RESET' | 'VERIFY') {
    const token = randomBytes(32).toString('hex');
    const now = this.clock();
    const issued = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const recent = await tx.accountToken.findFirst({
        where: { userId, kind, createdAt: { gt: new Date(now.getTime() - 60000) } },
      });
      if (recent) return false;
      await tx.accountToken.create({
        data: {
          userId,
          kind,
          tokenHash: accountTokenHash(token),
          createdAt: now,
          expiresAt: new Date(now.getTime() + (kind === 'RESET' ? 30 * 60000 : 24 * 3600000)),
        },
      });
      return true;
    });
    return issued ? token : null;
  }
  async request(email: string, kind: 'RESET' | 'VERIFY', userId?: string) {
    if (!this.email)
      throw new AppError(503, 'EMAIL_DISABLED', 'Email features are not configured yet.');
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user || (userId && user.id !== userId)) return;
    if (kind === 'VERIFY' && (await this.status(user.id)).emailVerified) return;
    const token = await this.issue(user.id, kind);
    if (!token) return;
    const url = new URL(kind === 'RESET' ? '/reset-password' : '/verify-email', this.origin);
    url.hash = new URLSearchParams({ token }).toString();
    try {
      await this.email.send({
        to: user.email,
        subject: kind === 'RESET' ? 'Reset your linkup password' : 'Verify your linkup email',
        text: `Open this link to ${kind === 'RESET' ? 'reset your password (valid for 30 minutes)' : 'verify your email (valid for 24 hours)'}:\n${url.href}\n\nIf you did not request this, ignore this email. Never share this link.`,
        idempotencyKey: accountTokenHash(token),
      });
    } catch {
      /* Public responses stay identical for registered and unknown addresses. */
      logger.warn('Account email delivery failed. Check provider configuration and quota.');
    }
  }
  async consume(token: string, password?: string) {
    const kind = password === undefined ? 'VERIFY' : 'RESET';
    const now = this.clock();
    const passwordHash = password === undefined ? undefined : await bcrypt.hash(password, 12);
    await this.db.$transaction(async (tx) => {
      const record = await tx.accountToken.findUnique({
        where: { tokenHash: accountTokenHash(token) },
      });
      if (!record || record.kind !== kind || record.usedAt || record.expiresAt <= now)
        throw invalidToken();
      const claimed = await tx.accountToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw invalidToken();
      if (passwordHash) {
        await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
        await tx.refreshToken.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.accountToken.updateMany({
          where: { userId: record.userId, kind: 'RESET', usedAt: null },
          data: { usedAt: now },
        });
      }
      await tx.accountIdentity.upsert({
        where: { userId: record.userId },
        create: { userId: record.userId, verifiedAt: now },
        update: { verifiedAt: now },
      });
    });
  }
}
