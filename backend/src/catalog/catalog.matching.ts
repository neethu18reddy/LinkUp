import type { CatalogRole } from './catalog.schemas.js';
import { catalogRoles, skillsById, skillsByDatabaseId } from './catalog.js';

const levels = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
};
const multipliers = { core: 3, important: 2, 'nice-to-have': 1 };
export interface KnownSkill {
  skillId: string;
  level: keyof typeof levels;
  percent?: number;
}
export function mergeLearningProfile(
  profile: KnownSkill[],
  progress: { skillId: string; status: string; percent: number }[],
): KnownSkill[] {
  return [
    ...profile,
    ...progress
      .filter((row) => row.status === 'DONE' || (row.status === 'IN_PROGRESS' && row.percent > 0))
      .map((row) => ({
        skillId: row.skillId,
        level: 'BEGINNER' as const,
        percent: row.status === 'DONE' ? 100 : row.percent,
      })),
  ];
}
export function scoreRole(role: CatalogRole, known: Map<string, number>) {
  let earned = 0,
    possible = 0;
  const matchedSkills: string[] = [],
    partialSkills: string[] = [],
    missingCoreSkills: string[] = [];
  for (const requirement of role.skills) {
    const skill = skillsById.get(requirement.skillId)!;
    const weight = requirement.weight * multipliers[requirement.importance];
    const current = known.get(skill.id) ?? 0;
    const adjacent = Math.max(0, ...skill.related.map((id) => (known.has(id) ? 0.15 : 0)));
    const credit = current ? Math.min(1, current / levels[requirement.requiredLevel]) : adjacent;
    earned += weight * credit;
    possible += weight;
    if (credit >= 1) matchedSkills.push(skill.name);
    else {
      if (credit > 0) partialSkills.push(skill.name);
      if (requirement.importance === 'core') missingCoreSkills.push(skill.name);
    }
  }
  return {
    score: possible ? earned / possible : 0,
    matchPercent: possible ? Math.round((earned / possible) * 100) : 0,
    matchedSkills,
    partialSkills,
    missingCoreSkills,
  };
}

export function rankRoles(profile: KnownSkill[], interests: string[] = [], roles = catalogRoles) {
  const known = new Map<string, number>();
  for (const row of profile) {
    const skill = skillsByDatabaseId.get(row.skillId) ?? skillsById.get(row.skillId);
    if (skill) {
      const amount = levels[row.level] * Math.max(0, Math.min(1, (row.percent ?? 100) / 100));
      if (amount > 0) known.set(skill.id, Math.max(known.get(skill.id) ?? 0, amount));
    }
  }
  const demand = { high: 3, medium: 2, low: 1 };
  const ranked = roles
    .map((role) => {
      const result = scoreRole(role, known);
      return {
        roleId: role.databaseId,
        slug: role.id,
        title: role.name,
        description: role.description,
        category: role.category,
        ...result,
        trending: role.trending,
        demand: role.demand,
        experienceBand: role.experienceBand,
        explanation: known.size
          ? `${result.matchedSkills.length} skills meet the target level; ${result.partialSkills.length} offer a partial or adjacent starting point. Focus next on ${result.missingCoreSkills.slice(0, 3).join(', ') || 'portfolio evidence'}.`
          : `Explore ${role.name} through its foundations and first project${interests.includes(role.category) ? ', based on your interests' : ''}.`,
      };
    })
    .sort((a, b) => {
      if (!known.size)
        return (
          Number(interests.includes(b.category)) - Number(interests.includes(a.category)) ||
          Number(b.experienceBand === 'entry') - Number(a.experienceBand === 'entry') ||
          Number(b.experienceBand === 'mid') - Number(a.experienceBand === 'mid') ||
          Number(b.trending) - Number(a.trending) ||
          a.title.localeCompare(b.title)
        );
      return (
        b.score - a.score ||
        Number(interests.includes(b.category)) - Number(interests.includes(a.category)) ||
        demand[b.demand] - demand[a.demand] ||
        Number(b.trending) - Number(a.trending) ||
        a.title.localeCompare(b.title)
      );
    });
  const selected = new Set(ranked.slice(0, 8).map((role) => role.roleId));
  return {
    recommendations: ranked.slice(0, 3),
    alternatives: ranked.slice(3, 8),
    stretchRoles: ranked
      .filter(
        (role) =>
          !selected.has(role.roleId) &&
          role.matchPercent > 0 &&
          role.matchPercent < 70 &&
          role.experienceBand === 'senior',
      )
      .slice(0, 3),
  };
}
