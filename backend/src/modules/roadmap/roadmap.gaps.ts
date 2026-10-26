import type { CareerRole } from '../roles/roles.types.js';
import type { ProfileSkill } from '../skills/skills.types.js';

const levels = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3 };
export function analyzeGaps(requirements: CareerRole['requirements'], profile: ProfileSkill[]) {
  const rows = requirements.map((requirement) => {
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
