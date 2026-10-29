import type { ProgressSnapshot } from '../modules/progress/progress.types.js';
import type { ProfileSkill } from '../modules/skills/skills.types.js';
import type { ChatMessage } from '../modules/chat/chat.types.js';
import { summarizeProgress } from '../modules/progress/progress.logic.js';

export function redactMentorText(text: string, identity: { name: string; email: string }) {
  let value = text;
  for (const literal of [identity.name, identity.email].filter((value) => value.length >= 3))
    value = value.replace(
      new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      '[private]',
    );
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, '[number]');
}
export function buildMentorContext(
  snapshot: ProgressSnapshot,
  profile: ProfileSkill[],
  today: string,
  identity: { name: string; email: string },
) {
  const summary = summarizeProgress(snapshot, today),
    clean = (value: string) => redactMentorText(value, identity).slice(0, 160);
  return {
    goal: summary.roadmap ? clean(summary.roadmap.title) : null,
    overallPercent: summary.overallPercent,
    completedTopics: summary.completedTopics,
    totalTopics: summary.totalTopics,
    currentPhase: summary.nextMilestone ? clean(summary.nextMilestone.title) : null,
    nextTopics: summary.topics
      .filter((topic) => topic.status !== 'DONE')
      .slice(0, 5)
      .map((topic) => ({
        title: clean(topic.title),
        isProject: topic.isProject,
        submitted: topic.submitted,
        status: topic.status,
      })),
    completedTopicsSample: summary.topics
      .filter((topic) => topic.status === 'DONE')
      .slice(-5)
      .map((topic) => clean(topic.title)),
    overdueHours: summary.overdueHours,
    weeklyPlan: summary.currentWeek
      ? {
          plannedHours: summary.currentWeek.plannedHours,
          loggedMinutes: summary.currentWeek.loggedMinutes,
          tasks: summary.currentWeek.tasks.slice(0, 8).map((task) => ({
            title: clean(task.title),
            status: task.status,
            isProject: task.isProject,
          })),
        }
      : null,
    recentLearning: summary.daily,
    streak: summary.streak,
    projectsRemaining: summary.projectsRequired - summary.projectsSubmitted,
    skills: profile
      .slice(0, 32)
      .map((skill) => ({ name: clean(skill.skill.name), level: skill.level })),
  };
}
export type MentorContext = ReturnType<typeof buildMentorContext>;
export function trimMentorHistory(
  messages: ChatMessage[],
  identity: { name: string; email: string },
  budget = 8000,
) {
  const selected: { role: 'USER' | 'ASSISTANT'; content: string }[] = [];
  let remaining = budget;
  for (const message of messages.slice(-12).reverse()) {
    if (remaining <= 0) break;
    // A long assistant answer used to discard the entire conversation, including
    // the learner's preceding question. Reserve room for that question instead.
    const limit =
      message.role === 'ASSISTANT'
        ? Math.min(3000, Math.floor(remaining / 2))
        : Math.min(1000, remaining);
    if (limit <= 0) continue;
    const original = redactMentorText(message.content, identity);
    const content =
      original.length > limit ? `${original.slice(0, Math.max(0, limit - 1))}…` : original;
    selected.unshift({ role: message.role, content });
    remaining -= content.length;
  }
  return selected;
}
