import type { GoalsRepository } from '../goals/goals.types.js';
import type { RolesRepository, CareerRole } from '../roles/roles.types.js';
import type { SkillsRepository } from '../skills/skills.types.js';
import { normalizeSkillName } from '../skills/skills.schemas.js';
import { AppError } from '../../utils/AppError.js';
import { generateValidated, type LLMProvider } from '../../ai/roadmap.provider.js';
import { analyzeGaps } from './roadmap.gaps.js';
import { buildTemplate, learningResources } from './roadmap.templates.js';
import { roadmapDraftSchema } from './roadmap.schemas.js';
import type { RoadmapRepository } from './roadmap.repository.js';

export class RoadmapService {
  constructor(
    private repository: RoadmapRepository,
    private goals: GoalsRepository,
    private roles: RolesRepository,
    private skills: SkillsRepository,
    private provider?: LLMProvider,
  ) {}
  async context(userId: string) {
    const goal = await this.goals.current(userId);
    if (!goal)
      throw new AppError(422, 'GOAL_REQUIRED', 'Choose a goal before generating a roadmap.');
    let role: CareerRole | null = goal.roleTemplateId
      ? await this.roles.find(goal.roleTemplateId)
      : null;
    if (!role) {
      const name = goal.targetRole.replace(/^learn\s+/i, '');
      const catalogue = await this.skills.listCatalogue(name);
      const match =
        catalogue.find((skill) => normalizeSkillName(skill.name) === normalizeSkillName(name)) ??
        (catalogue.length === 1 ? catalogue[0] : undefined);
      const matchingRole = !match
        ? (await this.roles.list()).find(
            (entry) => normalizeSkillName(entry.title) === normalizeSkillName(name),
          )
        : null;
      role =
        matchingRole ??
        (match
          ? {
              id: match.id,
              slug: 'custom-skill',
              title: match.name,
              description: 'Develop this skill with guided practice.',
              requirements: [
                { skillId: match.id, requiredLevel: 'INTERMEDIATE', weight: 1, skill: match },
              ],
            }
          : {
              id: goal.id,
              slug: 'custom-goal',
              title: goal.targetRole,
              description: 'A self-directed learning goal with an adaptable starter plan.',
              requirements: [],
            });
    }
    const profile = await this.skills.listProfile(userId);
    return { goal, role, analysis: analyzeGaps(role.requirements, profile) };
  }
  async current(userId: string) {
    const context = await this.context(userId);
    return {
      goalId: context.goal.id,
      analysis: context.analysis,
      roadmap: await this.repository.latest(userId, context.goal.id),
      provider: this.provider?.name ?? 'template',
    };
  }
  async get(userId: string, id: string) {
    const roadmap = await this.repository.find(userId, id);
    if (!roadmap) throw new AppError(404, 'ROADMAP_NOT_FOUND', 'Roadmap not found.');
    return roadmap;
  }
  async generate(userId: string, goalId: string) {
    const { goal, role, analysis } = await this.context(userId);
    if (goal.id !== goalId)
      throw new AppError(409, 'GOAL_CHANGED', 'Your goal changed. Review the latest goal.');
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    await this.repository.reserve(userId, goalId, date);
    const fallback = roadmapDraftSchema.parse(buildTemplate(role, analysis));
    let draft = fallback;
    let source = role.slug === 'custom-goal' ? 'template-custom' : 'template';
    if (this.provider && role.requirements.length) {
      const generated = await generateValidated(
        this.provider,
        {
          role: role.title,
          requirements: role.requirements,
          analysis,
          resources: learningResources,
        },
        new Set(role.requirements.map((row) => row.skillId)),
        undefined,
        new Set(analysis.gaps.map((row) => row.skillId)),
      );
      if (generated) {
        // Keep only curated links: model-generated URLs cannot be trusted.
        const urls = new Set(Object.values(learningResources).map((resource) => resource.url));
        draft = {
          ...generated,
          phases: generated.phases.map((phase) => ({
            ...phase,
            topics: phase.topics.map((topic) => ({
              ...topic,
              resources: topic.resources.filter((resource) => urls.has(resource.url)),
            })),
          })),
        };
        source = this.provider.name;
      } else source = 'template-fallback';
    }
    return {
      roadmap: await this.repository.save(userId, goalId, draft, source),
      analysis,
      notice:
        source === 'template-custom'
          ? 'A general starter roadmap was saved for your custom goal. Choose your learning materials and adapt the practice tasks to your subject.'
          : source === 'template-fallback'
            ? 'AI generation was unavailable. A curated template was saved instead.'
            : null,
    };
  }
  async regenerate(userId: string, id: string) {
    const previous = await this.get(userId, id);
    return this.generate(userId, previous.goalId);
  }
}
