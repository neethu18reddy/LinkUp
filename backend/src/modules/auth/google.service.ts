import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { matchesCronSecret } from '../../jobs/weekly.js';

const stateSchema = z.object({
  kind: z.literal('google-login'),
  state: z.string().length(64),
  nonce: z.string().length(64),
  verifier: z.string().min(43).max(128),
});
export const googleProfileSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.email().transform((value) => value.toLowerCase()),
  email_verified: z.literal(true),
  name: z.string().trim().min(1).max(100).optional(),
  nonce: z.string(),
});
export class GoogleService {
  private client: OAuth2Client;
  private callback: string;
  constructor(
    private db: PrismaClient,
    origin: string,
    private clientId: string,
    clientSecret: string,
    private signingSecret: string,
  ) {
    this.callback = new URL('/api/v1/auth/google/callback', origin).href;
    this.client = new OAuth2Client(clientId, clientSecret, this.callback);
  }
  async start() {
    const { codeVerifier, codeChallenge } = await this.client.generateCodeVerifierAsync();
    const state = randomBytes(32).toString('hex'),
      nonce = randomBytes(32).toString('hex');
    const cookie = jwt.sign(
      { kind: 'google-login', state, nonce, verifier: codeVerifier },
      this.signingSecret,
      { algorithm: 'HS256', expiresIn: '10m', audience: 'google-oauth', issuer: 'linkup' },
    );
    const url = this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      nonce,
      code_challenge: codeChallenge!,
      code_challenge_method: CodeChallengeMethod.S256,
      prompt: 'select_account',
    });
    return { cookie, url };
  }
  readState(cookie: string | undefined, state: string) {
    try {
      const payload = stateSchema.parse(
        jwt.verify(cookie ?? '', this.signingSecret, {
          algorithms: ['HS256'],
          audience: 'google-oauth',
          issuer: 'linkup',
        }),
      );
      if (!matchesCronSecret(payload.state, state)) throw new Error('state mismatch');
      return payload;
    } catch {
      throw new AppError(
        400,
        'GOOGLE_STATE_INVALID',
        'Google sign-in expired. Start again from the login page.',
      );
    }
  }
  async complete(cookie: string | undefined, state: string, code: string) {
    const payload = this.readState(cookie, state);
    let profile: z.infer<typeof googleProfileSchema>;
    try {
      const { tokens } = await this.client.getToken({
        code,
        codeVerifier: payload.verifier,
        redirect_uri: this.callback,
      });
      if (!tokens.id_token) throw new Error('missing identity');
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.clientId,
      });
      profile = googleProfileSchema.parse(ticket.getPayload());
      if (!matchesCronSecret(profile.nonce, payload.nonce)) throw new Error('nonce mismatch');
    } catch {
      throw new AppError(
        401,
        'GOOGLE_LOGIN_FAILED',
        'Google sign-in could not be verified. Please try again.',
      );
    }
    return this.identity(profile);
  }
  async identity(profile: Pick<z.infer<typeof googleProfileSchema>, 'sub' | 'email' | 'name'>) {
    const existing = await this.db.accountIdentity.findUnique({
      where: { googleSubject: profile.sub },
      include: { user: true },
    });
    if (existing) return existing.user;
    // Do not silently link a password account solely because an OAuth email matches.
    if (await this.db.user.findUnique({ where: { email: profile.email } }))
      throw new AppError(
        409,
        'GOOGLE_ACCOUNT_EXISTS',
        'This email already has a linkup account. Sign in with your password, or use password recovery.',
      );
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    try {
      return await this.db.user.create({
        data: {
          email: profile.email,
          name: profile.name || 'Learner',
          passwordHash,
          identity: { create: { googleSubject: profile.sub, verifiedAt: new Date() } },
        },
      });
    } catch {
      throw new AppError(
        409,
        'GOOGLE_ACCOUNT_EXISTS',
        'An account already exists. Please try signing in again.',
      );
    }
  }
}
