import type { CatalogRole, CatalogRoadmap } from './catalog.schemas.js';
import { skillsById, orderSkills } from './catalog.js';

export function buildCatalogRoadmap(role: CatalogRole): CatalogRoadmap {
  const multiplier = { core: 3, important: 2, 'nice-to-have': 1 };
  const ordered = orderSkills(
    [...role.skills]
      .sort((a, b) => multiplier[b.importance] - multiplier[a.importance])
      .map((row) => row.skillId),
    skillsById,
  );
  const titles = ['Foundations', 'Core skills', 'Tools & ecosystem', 'Advanced & specialization'];
  const goals = [
    'Explain and demonstrate the prerequisites',
    'Solve a representative role task',
    'Integrate a repeatable professional workflow',
    'Evaluate tradeoffs and handle realistic constraints',
  ];
  const stages = titles.map((title, index) => {
    const skills = ordered.slice(
      Math.floor((index * ordered.length) / 4),
      Math.floor(((index + 1) * ordered.length) / 4),
    );
    const names = skills.map((id) => skillsById.get(id)!.name);
    return {
      order: index + 1,
      title,
      skills,
      goal: `${goals[index]} for ${role.name}, using ${names.slice(0, 3).join(', ') || 'the project brief'}.`,
      estimatedWeeks: Math.ceil(
        (skills.reduce((sum, id) => sum + skillsById.get(id)!.estimatedHours, 0) + 4) / 10,
      ),
      milestoneProject:
        index === 3
          ? role.project
          : `${role.name} ${title.toLowerCase()} study: demonstrate ${names.slice(0, 3).join(', ') || 'a baseline workflow'} in a small, reviewable artifact.`,
      checkpoint:
        index === 3
          ? role.checkpoint
          : `Explain decisions, demonstrate ${names.slice(0, 2).join(' and ') || 'the workflow'}, and check the artifact against written acceptance criteria.`,
    };
  });
  if (role.experienceBand === 'senior')
    stages.push({
      order: 5,
      title: 'Leadership & professional judgment',
      skills: [],
      goal: `Assess operational, ethical and stakeholder tradeoffs in ${role.name} work.`,
      estimatedWeeks: 1,
      milestoneProject: `Write a decision memo and lead a peer review of the ${role.name} project.`,
      checkpoint: 'Defend alternatives, record risks and ownership, and incorporate peer feedback.',
    });
  const interviewTopics = role.skills
    .filter((row) => row.importance !== 'nice-to-have')
    .slice(0, 6)
    .map((row) => skillsById.get(row.skillId)!.name);
  stages.push({
    order: stages.length + 1,
    title: 'Portfolio & job readiness',
    skills: [],
    estimatedWeeks: 1,
    goal: `Communicate evidence of readiness for ${role.name} opportunities.`,
    milestoneProject: `Publish a ${role.name} case study, tailor a resume and rehearse a project walkthrough.`,
    checkpoint: `Explain ${interviewTopics.slice(0, 3).join(', ')}, show project evidence, state limitations, and answer follow-up questions.`,
  });
  const total = stages.reduce((sum, stage) => sum + stage.estimatedWeeks, 0);
  return {
    roleId: role.id,
    stages,
    durationWeeks: {
      beginner: total,
      intermediate: Math.ceil(total * 0.65),
      advanced: Math.ceil(total * 0.35),
    },
    interviewTopics,
    resumeKeywords: interviewTopics,
  };
}
