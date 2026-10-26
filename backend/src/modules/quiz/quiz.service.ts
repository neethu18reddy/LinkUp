import type { QuizResponse } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import type { CareerRole } from '../roles/roles.types.js';
import type { RolesService } from '../roles/roles.service.js';
import { dimensions, dimensionReasons, quizQuestions, roleAffinities } from './quiz.data.js';
import {
  quizAnswerSchema,
  recommendationSchema,
  type QuizAnswer,
  type Recommendation,
} from './quiz.schemas.js';
import type { QuizRepository } from './quiz.types.js';

export function recommendRoles(
  answers: QuizAnswer[],
  roles: CareerRole[],
  skillIds: string[],
): Recommendation[] {
  const votes = Object.fromEntries(
    dimensions.map((dimension) => [
      dimension,
      answers.filter((answer) => answer.optionId === dimension).length,
    ]),
  ) as Record<(typeof dimensions)[number], number>;
  return roles
    .map((role) => {
      const weights = roleAffinities[role.slug];
      const matched = role.requirements.filter((requirement) =>
        skillIds.includes(requirement.skillId),
      );
      const interests = weights
        ? dimensions
            .filter((dimension) => votes[dimension] > 0 && weights[dimension] > 0)
            .sort((a, b) => votes[b] * weights[b] - votes[a] * weights[a] || a.localeCompare(b))
        : [];
      const score = weights
        ? dimensions.reduce((sum, dimension) => sum + votes[dimension] * weights[dimension], 0)
        : 0;
      const reasons = interests.length
        ? [
            `Your answers show interest in ${interests
              .slice(0, 2)
              .map((dimension) => dimensionReasons[dimension])
              .join(' and ')}.`,
          ]
        : ['This offers another direction to explore alongside your main interests.'];
      if (matched.length)
        reasons.push(
          `Your profile already includes ${matched
            .slice(0, 3)
            .map((requirement) => requirement.skill.name)
            .join(', ')}.`,
        );
      return {
        score,
        matches: matched.length,
        slug: role.slug,
        recommendation: {
          roleId: role.id,
          title: role.title,
          description: role.description,
          reasons,
        },
      };
    })
    .sort((a, b) => b.score - a.score || b.matches - a.matches || a.slug.localeCompare(b.slug))
    .slice(0, 3)
    .map((result) => result.recommendation);
}

function snapshot(record: QuizResponse) {
  return {
    id: record.id,
    answers: quizAnswerSchema.array().parse(record.answers),
    recommendations: recommendationSchema.array().parse(record.recommendedRoles),
    createdAt: record.createdAt,
  };
}
export class QuizService {
  constructor(
    private readonly repository: QuizRepository,
    private readonly roles: RolesService,
  ) {}
  questions() {
    return quizQuestions;
  }
  async submit(userId: string, answers: QuizAnswer[]) {
    const [roles, skillIds] = await Promise.all([
      this.roles.list(),
      this.repository.skillIds(userId),
    ]);
    if (roles.length < 3)
      throw new AppError(
        503,
        'ROLES_UNAVAILABLE',
        'There are not enough roles available yet. Please try again later.',
      );
    return snapshot(
      await this.repository.save(userId, answers, recommendRoles(answers, roles, skillIds)),
    );
  }
  async latest(userId: string) {
    const record = await this.repository.latest(userId);
    return record ? snapshot(record) : null;
  }
  async assertRecommendation(userId: string, id: string, roleId: string) {
    const record = await this.repository.find(userId, id);
    if (!record)
      throw new AppError(
        404,
        'QUIZ_NOT_FOUND',
        'This quiz result is not available for your account. Please retake the quiz.',
      );
    if (!snapshot(record).recommendations.some((item) => item.roleId === roleId))
      throw new AppError(
        422,
        'ROLE_NOT_RECOMMENDED',
        'Choose a role from your quiz results or select it directly.',
      );
  }
}
