import type { QuizResponse } from '../../generated/prisma/client.js';
import type { QuizAnswer, Recommendation } from './quiz.schemas.js';

export interface QuizRepository {
  skillIds(userId: string): Promise<string[]>;
  save(
    userId: string,
    answers: QuizAnswer[],
    recommendations: Recommendation[],
  ): Promise<QuizResponse>;
  latest(userId: string): Promise<QuizResponse | null>;
  find(userId: string, id: string): Promise<QuizResponse | null>;
}
