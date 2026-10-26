import type { RolesService } from '../roles/roles.service.js';
import type { QuizService } from '../quiz/quiz.service.js';
import type { CreateGoalInput } from './goals.schemas.js';
import type { GoalsRepository } from './goals.types.js';

export class GoalsService {
  constructor(
    private readonly repository: GoalsRepository,
    private readonly roles: RolesService,
    private readonly quiz: QuizService,
  ) {}
  current(userId: string) {
    return this.repository.current(userId);
  }
  async create(userId: string, input: CreateGoalInput) {
    if (input.kind === 'CUSTOM')
      return this.repository.replace({
        userId,
        targetRole: input.targetRole,
        roleTemplateId: null,
        source: 'DIRECT',
        expectedGoalId: input.expectedGoalId,
      });
    const role = await this.roles.find(input.roleId);
    if (input.quizResponseId)
      await this.quiz.assertRecommendation(userId, input.quizResponseId, role.id);
    return this.repository.replace({
      userId,
      targetRole: role.title,
      roleTemplateId: role.id,
      source: input.quizResponseId ? 'QUIZ' : 'DIRECT',
      expectedGoalId: input.expectedGoalId,
    });
  }
}
