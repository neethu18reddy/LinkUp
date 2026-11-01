import { describe, expect, it } from 'vitest';
import {
  catalogRoles,
  catalogSkills,
  rolesById,
  skillsById,
  searchCatalogSkills,
  categories,
} from '../src/catalog/catalog.js';
import { scoreRole, rankRoles } from '../src/catalog/catalog.matching.js';
import { buildCatalogRoadmap } from '../src/catalog/catalog.roadmaps.js';
import { catalogRoadmapSchema } from '../src/catalog/catalog.schemas.js';
import { analyzeGaps } from '../src/modules/roadmap/roadmap.gaps.js';
import { buildTemplate } from '../src/modules/roadmap/roadmap.templates.js';
import { roadmapDraftSchema } from '../src/modules/roadmap/roadmap.schemas.js';
import type { CareerRole } from '../src/modules/roles/roles.types.js';

describe('expanded catalog', () => {
  it('includes common transferable foundations and canonical tool aliases', () => {
    for (const id of [
      'collaboration',
      'critical-thinking',
      'time-management',
      'adaptability',
      'ownership',
      'presentation-skills',
      'empathy',
      'active-listening',
      'matlab',
      'operating-systems',
    ])
      expect(skillsById.has(id), id).toBe(true);
    expect(searchCatalogSkills('ga4')[0]!.name).toBe('Google Analytics 4');
    expect(searchCatalogSkills('golang')[0]!.name).toBe('Go');
    expect(searchCatalogSkills('shell')[0]!.name).toBe('Bash');
    expect(rolesById.get('data-scientist')!.category).toBe('data');
    expect(rolesById.get('robotics-engineer')!.category).toBe('ai-ml');
    expect(rolesById.get('security-tester')!.category).toBe('quality');
    expect(rolesById.get('associate-product-manager')!.experienceBand).toBe('entry');
  });
  it('covers all domains with the requested counts and unique stable database IDs', () => {
    expect(catalogSkills.length).toBeGreaterThanOrEqual(1500);
    expect(catalogRoles.length).toBeGreaterThanOrEqual(300);
    expect(categories).toHaveLength(12);
    expect(catalogRoles.every((role) => role.skills.length >= 6 && role.skills.length <= 15)).toBe(
      true,
    );
    expect(new Set(catalogSkills.map((skill) => skill.databaseId)).size).toBe(catalogSkills.length);
    expect(skillsById.get('react')!.databaseId).toBe('00000000-0000-4000-8000-000000000005');
    expect(rolesById.get('frontend-developer')!.databaseId).toBe(
      '10000000-0000-4000-8000-000000000001',
    );
  });
  it('searches aliases, domains and spelling variants without returning the entire catalog', () => {
    expect(searchCatalogSkills('reactjs')[0]!.name).toBe('React');
    expect(searchCatalogSkills('pythno').some((skill) => skill.name === 'Python')).toBe(true);
    expect(searchCatalogSkills('', 'finance', 20)).toHaveLength(20);
    expect(searchCatalogSkills('a'.repeat(100))).toEqual([]);
  });
  it('produces valid stage blueprints and saved personalized drafts for every role', () => {
    for (const role of catalogRoles) {
      expect(catalogRoadmapSchema.safeParse(buildCatalogRoadmap(role)).success, role.id).toBe(true);
      const dbRole: CareerRole = {
        id: role.databaseId,
        catalogId: role.id,
        slug: role.id,
        title: role.name,
        description: role.description,
        requirements: role.skills.map((row) => ({
          skillId: skillsById.get(row.skillId)!.databaseId,
          requiredLevel: row.requiredLevel.toUpperCase() as
            'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED',
          weight: row.weight,
          skill: { name: skillsById.get(row.skillId)!.name, category: role.category },
        })),
      };
      const analysis = analyzeGaps(dbRole.requirements, [], true);
      expect(roadmapDraftSchema.safeParse(buildTemplate(dbRole, analysis)).success, role.id).toBe(
        true,
      );
    }
  });
  it('skips satisfied skills while automatically including missing prerequisites', () => {
    const role = rolesById.get('react-developer')!;
    const dbRole: CareerRole = {
      id: role.databaseId,
      catalogId: role.id,
      slug: role.id,
      title: role.name,
      description: role.description,
      requirements: [
        {
          skillId: skillsById.get('react')!.databaseId,
          requiredLevel: 'INTERMEDIATE',
          weight: 3,
          skill: { name: 'React', category: 'development' },
        },
      ],
    };
    const profile = [
      {
        skillId: dbRole.requirements[0]!.skillId,
        level: 'ADVANCED' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        skill: { id: dbRole.requirements[0]!.skillId, name: 'React', category: 'development' },
      },
    ];
    const analysis = analyzeGaps(dbRole.requirements, profile, true);
    const topics = buildTemplate(dbRole, analysis).phases.flatMap((phase) => phase.topics);
    expect(analysis.strengths.map((row) => row.name)).toContain('React');
    expect(topics.some((topic) => topic.title === 'React')).toBe(false);
    expect(topics.some((topic) => topic.title === 'JavaScript')).toBe(true);
  });
});

describe('weighted career matching', () => {
  const base = catalogRoles[0]!;
  const role = {
    ...base,
    skills: [
      {
        skillId: 'python',
        importance: 'core' as const,
        weight: 3,
        requiredLevel: 'intermediate' as const,
      },
      {
        skillId: 'sql',
        importance: 'important' as const,
        weight: 1,
        requiredLevel: 'advanced' as const,
      },
    ],
  };
  it('weights importance and proficiency with partial credit', () => {
    expect(scoreRole(role, new Map([['python', 2]])).matchPercent).toBe(82);
    expect(scoreRole(role, new Map([['python', 1]])).matchPercent).toBe(41);
    expect(
      scoreRole(
        role,
        new Map([
          ['python', 3],
          ['sql', 3],
        ]),
      ).matchPercent,
    ).toBe(100);
    expect(scoreRole(role, new Map()).matchPercent).toBe(0);
  });
  it('gives small adjacent credit without presenting it as a satisfied core skill', () => {
    const adjacentRole = {
      ...base,
      skills: [
        {
          skillId: 'react',
          importance: 'core' as const,
          weight: 1,
          requiredLevel: 'intermediate' as const,
        },
      ],
    };
    const result = scoreRole(adjacentRole, new Map([['vue', 3]]));
    expect(result.matchPercent).toBe(15);
    expect(result.matchedSkills).toEqual([]);
    expect(result.missingCoreSkills).toContain('React');
  });
  it('handles unknown skills, zero skills, duplicate profile entries and deterministic ties', () => {
    const empty = rankRoles([], ['finance']);
    expect(empty.recommendations).toHaveLength(3);
    expect(empty.alternatives).toHaveLength(5);
    expect(empty.recommendations.every((role) => role.category === 'finance')).toBe(true);
    expect(rankRoles([{ skillId: 'unknown', level: 'ADVANCED' }])).toEqual(rankRoles([]));
    expect(
      rankRoles([
        { skillId: 'python', level: 'BEGINNER' },
        { skillId: 'python', level: 'ADVANCED' },
      ]),
    ).toEqual(rankRoles([{ skillId: 'python', level: 'ADVANCED' }]));
    expect(rankRoles([], [], [...catalogRoles].reverse())).toEqual(rankRoles([]));
  });
  it('scores the full catalog within the interactive budget', () => {
    const profile = catalogSkills
      .slice(0, 1000)
      .map((skill) => ({ skillId: skill.databaseId, level: 'INTERMEDIATE' as const }));
    rankRoles(profile);
    const start = performance.now();
    for (let run = 0; run < 10; run++) rankRoles(profile);
    expect((performance.now() - start) / 10).toBeLessThan(100);
  });
});
