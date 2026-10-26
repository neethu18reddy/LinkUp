import { randomUUID } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import OpenAI from 'openai';
import { analyzeGaps } from '../src/modules/roadmap/roadmap.gaps.js';
import { buildTemplate } from '../src/modules/roadmap/roadmap.templates.js';
import { roadmapDraftSchema } from '../src/modules/roadmap/roadmap.schemas.js';
import { generateValidated } from '../src/ai/roadmap.provider.js';
import { RoadmapService } from '../src/modules/roadmap/roadmap.service.js';
import {
  loadCareerRoles,
  MemoryGoalsRepository,
  MemoryRolesRepository,
} from './helpers/memory-career-repositories.js';
import { MemorySkillsRepository, reactSkill } from './helpers/memory-skills-repository.js';
import type { RoadmapRepository, SavedRoadmap } from '../src/modules/roadmap/roadmap.repository.js';

const roles = await loadCareerRoles();
const role = roles[0]!;
const analysis = analyzeGaps(role.requirements, []);
const template = buildTemplate(role, analysis);
describe('roadmap engineering', () => {
  it('ranks weighted gaps and separates proficiency strengths', () => {
    const react = roles.find((role) => role.slug === 'frontend-developer')!;
    const result = analyzeGaps(react.requirements, [
      {
        skillId: reactSkill.id,
        skill: reactSkill,
        level: 'ADVANCED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    expect(result.strengths.map((row) => row.name)).toContain('React');
    expect(
      result.gaps.every((row, index) => index === 0 || result.gaps[index - 1]!.score >= row.score),
    ).toBe(true);
    expect(result.gaps.find((row) => row.name === 'JavaScript')?.score).toBe(6);
  });
  it.each(roles.map((role) => [role.slug, role] as const))(
    'validates the offline template for %s',
    (_slug, role) => {
      expect(
        roadmapDraftSchema.safeParse(buildTemplate(role, analyzeGaps(role.requirements, [])))
          .success,
      ).toBe(true);
    },
  );
  it('retries malformed JSON and invalid structures with feedback', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce('bad json')
      .mockResolvedValueOnce('{}')
      .mockResolvedValue(JSON.stringify(template));
    expect(
      await generateValidated(
        { name: 'mock', generate },
        { analysis },
        new Set(role.requirements.map((row) => row.skillId)),
      ),
    ).toEqual(template);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(generate.mock.calls[2]![0]).toContain('Validation errors');
  });
  it('rejects foreign skill references and projects missing from otherwise valid JSON', async () => {
    const invalid = structuredClone(template);
    invalid.phases[0]!.topics[0]!.skillId = randomUUID();
    const generate = vi.fn().mockResolvedValue(JSON.stringify(invalid));
    expect(await generateValidated({ name: 'mock', generate }, {}, new Set())).toBeNull();
    expect(generate).toHaveBeenCalledTimes(3);
    invalid.phases.forEach((phase) => phase.topics.forEach((topic) => (topic.isProject = false)));
    expect(roadmapDraftSchema.safeParse(invalid).success).toBe(false);
  });
  it('backs off on rate limits and caps requests at three', async () => {
    const generate = vi
      .fn()
      .mockRejectedValue(new OpenAI.APIError(429, undefined, 'Rate limited', new Headers()));
    const sleep = vi.fn().mockResolvedValue(undefined);
    expect(await generateValidated({ name: 'mock', generate }, {}, new Set(), sleep)).toBeNull();
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
  });
  it('preserves owned versions and uses fallback without exposing account data', async () => {
    const goals = new MemoryGoalsRepository();
    const skills = new MemorySkillsRepository();
    const goal = await goals.replace({
      userId: 'owner',
      roleTemplateId: role.id,
      targetRole: role.title,
      source: 'DIRECT',
      expectedGoalId: null,
    });
    const records: SavedRoadmap[] = [];
    const repository: RoadmapRepository = {
      reserve: vi.fn().mockResolvedValue(undefined),
      save: vi.fn(async (_user, id, draft, source) => {
        const saved = {
          id: randomUUID(),
          goalId: id,
          title: draft.title,
          version: records.length + 1,
          generationSource: source,
          totalEstimatedHours: 1,
          createdAt: new Date().toISOString(),
          status: 'DRAFT',
          phases: [],
        } as SavedRoadmap;
        records.push(saved);
        return saved;
      }),
      find: async (user, id) =>
        user === 'owner' ? (records.find((row) => row.id === id) ?? null) : null,
      latest: async () => records.at(-1) ?? null,
    };
    const generate = vi.fn().mockRejectedValue(new Error('Provider offline'));
    const service = new RoadmapService(
      repository,
      goals,
      new MemoryRolesRepository(roles),
      skills,
      { name: 'mock', generate },
    );
    const first = await service.generate('owner', goal.id);
    await service.regenerate('owner', first.roadmap.id);
    expect(records).toHaveLength(2);
    expect(records[1]!.version).toBe(2);
    expect(first.roadmap.generationSource).toBe('template-fallback');
    expect(generate.mock.calls[0]![0]).not.toContain('owner');
    await expect(service.get('other', first.roadmap.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.generate('owner', randomUUID())).rejects.toMatchObject({
      statusCode: 409,
    });
  });
  it('rejects unknown custom goals before consuming quota and normalizes known aliases', async () => {
    const goals = new MemoryGoalsRepository();
    const skills = new MemorySkillsRepository();
    const repository = { reserve: vi.fn() } as unknown as RoadmapRepository;
    await goals.replace({
      userId: 'owner',
      roleTemplateId: null,
      targetRole: 'Learn ReactJS',
      source: 'DIRECT',
      expectedGoalId: null,
    });
    const service = new RoadmapService(repository, goals, new MemoryRolesRepository(roles), skills);
    expect((await service.context('owner')).role.title).toBe('React');
    const goal = await goals.current('owner');
    await goals.replace({
      userId: 'owner',
      roleTemplateId: null,
      targetRole: 'Learn something unknown',
      source: 'DIRECT',
      expectedGoalId: goal!.id,
    });
    await expect(service.generate('owner', goal!.id)).rejects.toMatchObject({ statusCode: 422 });
    expect(repository.reserve).not.toHaveBeenCalled();
  });
});
