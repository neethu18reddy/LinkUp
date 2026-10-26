import { getDatabase } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import type { QuizAnswer, Recommendation } from './quiz.schemas.js';
import type { QuizRepository } from './quiz.types.js';

function database() {
  const client = getDatabase();
  if (!client)
    throw new AppError(
      503,
      'DATABASE_NOT_CONFIGURED',
      'The database is not configured. Please contact the administrator.',
    );
  return client;
}
export class PrismaQuizRepository implements QuizRepository {
  async skillIds(userId: string) {
    return (
      await database().userSkill.findMany({ where: { userId }, select: { skillId: true } })
    ).map((skill) => skill.skillId);
  }
  save(userId: string, answers: QuizAnswer[], recommendations: Recommendation[]) {
    return database().quizResponse.create({
      data: { userId, answers, recommendedRoles: recommendations },
    });
  }
  latest(userId: string) {
    return database().quizResponse.findFirst({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
  find(userId: string, id: string) {
    return database().quizResponse.findFirst({ where: { id, userId } });
  }
}
