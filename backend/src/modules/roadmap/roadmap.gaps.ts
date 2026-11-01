import type { CareerRole } from '../roles/roles.types.js';
import type { ProfileSkill } from '../skills/skills.types.js';
import { skillsByDatabaseId, skillsById, orderSkills } from '../../catalog/catalog.js';

const levels = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3 };
export function analyzeGaps(
  requirements: CareerRole['requirements'],
  profile: ProfileSkill[],
  expandPrerequisites = false,
) {
  const expanded = [...requirements];
  if (expandPrerequisites) {
    const ids = requirements.flatMap((row) => skillsByDatabaseId.get(row.skillId)?.id ?? []);
    for (const id of orderSkills(ids, skillsById)) {
      const skill = skillsById.get(id)!;
      if (!expanded.some((row) => row.skillId === skill.databaseId))
        expanded.push({
          skillId: skill.databaseId,
          requiredLevel: 'BEGINNER',
          weight: 1,
          skill: { name: skill.name, category: skill.category },
        });
    }
  }
  const rows = expanded.map((requirement) => {
    const current = profile.find((skill) => skill.skillId === requirement.skillId)?.level ?? null;
    const deficit = Math.max(
      0,
      levels[requirement.requiredLevel] - (current ? levels[current] : 0),
    );
    return {
      skillId: requirement.skillId,
      name: requirement.skill.name,
      currentLevel: current,
      requiredLevel: requirement.requiredLevel,
      weight: requirement.weight,
      score: deficit * requirement.weight,
    };
  });
  return {
    gaps: rows
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    strengths: rows.filter((row) => row.score === 0),
  };
}
