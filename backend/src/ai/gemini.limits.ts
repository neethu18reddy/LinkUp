import { AppError } from '../utils/AppError.js';

// Explicit allowlist: Google calls never fall back to a different model.
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

// Conservative application limits, not a claim about Google's project quota.
// Shared by mentor and roadmap calls within one server process.
export class GeminiCallBudget {
  private attempts: number[] = [];
  private active = false;
  private cooldownUntil = 0;

  constructor(private now: () => number = Date.now) {}

  acquire() {
    const now = this.now();
    this.attempts = this.attempts.filter((time) => time > now - 86_400_000);
    if (
      this.active ||
      now < this.cooldownUntil ||
      this.attempts.length >= 50 ||
      this.attempts.filter((time) => time > now - 60_000).length >= 5
    )
      throw new AppError(
        429,
        'MENTOR_QUOTA',
        'The shared AI limit is reached. Allow the current reply to finish or wait a minute. The daily limit is 50 calls per server; if exhausted, try tomorrow.',
      );
    this.attempts.push(now);
    this.active = true;
    return () => {
      this.active = false;
    };
  }

  quotaExceeded() {
    this.cooldownUntil = this.now() + 60_000;
  }
}

export const geminiCallBudget = new GeminiCallBudget();
