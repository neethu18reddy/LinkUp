import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
export class BrevoEmailProvider implements EmailProvider {
  constructor(
    private key: string,
    private from: string,
    private transport: typeof fetch = fetch,
  ) {}
  async send(message: EmailMessage) {
    try {
      const response = await this.transport('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', 'api-key': this.key },
        body: JSON.stringify({
          sender: { email: this.from, name: 'linkup' },
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          headers: { IdempotencyKey: message.idempotencyKey },
        }),
      });
      if (!response.ok) throw new Error('delivery rejected');
    } catch {
      throw new AppError(
        503,
        'EMAIL_UNAVAILABLE',
        'Email delivery is temporarily unavailable. Please retry later.',
      );
    }
  }
}
export function configuredEmailProvider(): EmailProvider | undefined {
  if (env.EMAIL_PROVIDER !== 'brevo' || !env.EMAIL_LIVE_CALLS_APPROVED) return undefined;
  if (!env.BREVO_API_KEY || !env.EMAIL_FROM)
    throw new Error('Configure the approved email provider.');
  return new BrevoEmailProvider(env.BREVO_API_KEY, env.EMAIL_FROM);
}
