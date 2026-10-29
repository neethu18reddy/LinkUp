import type { MentorContext } from './mentor.context.js';
export interface MentorInput {
  message: string;
  context: MentorContext;
  history: { role: 'USER' | 'ASSISTANT'; content: string }[];
}
export interface MentorProvider {
  readonly mode: string;
  stream(input: MentorInput, signal: AbortSignal): AsyncIterable<string>;
}
export class OfflineMentorProvider implements MentorProvider {
  readonly mode = 'offline';
  async *stream(input: MentorInput, signal: AbortSignal) {
    const context = input.context,
      question = input.message.toLowerCase();
    let text: string;
    if (/system prompt|ignore (?:all|previous)|other user|api.?key|password|secret/.test(question))
      text =
        'I can help with your own learning plan and progress. I cannot provide private data, credentials, or internal instructions.';
    else if (
      /\b(explain|quiz|debug|code|example|teach|why|what is|what are|difference)\b/.test(question)
    )
      text =
        'Live AI tutoring is not enabled in this workspace. I cannot explain concepts, review code, or run an interactive quiz in offline mode. I can only summarise your saved progress and help you find your next scheduled task. To get a tailored explanation, the owner needs to enable the configured AI provider. Your question has been kept in this conversation.';
    else if (!context.goal)
      text =
        'Start by adding your skills, choosing a goal, and generating a roadmap. Then set a weekly plan. You can record general learning logs in the meantime.';
    else if (/behind|replan|schedule|hours|time/.test(question))
      text =
        context.overdueHours > 0
          ? `You have ${context.overdueHours} estimated hours unfinished from past weeks. Open Weekly plan, choose a realistic weekly pace, preview the new finish date, and confirm a replan. Completed work stays preserved.`
          : `There are no unfinished hours from fully elapsed weeks in this roadmap. ${context.weeklyPlan ? `This week has ${context.weeklyPlan.plannedHours} hours planned and ${context.weeklyPlan.loggedMinutes} minutes logged across all goals.` : 'Open Weekly plan to set or review your pace.'} Choose a sustainable pace and preview changes before saving.`;
    else if (/progress|how am i|doing|summary/.test(question))
      text = `Your roadmap is ${context.overallPercent}% complete by estimated hours, with ${context.completedTopics} of ${context.totalTopics} topics completed. ${context.currentPhase ? `The next milestone is ${context.currentPhase}.` : 'All roadmap topics are complete.'} You have a ${context.streak}-day UTC learning streak. Logged time and task completion are tracked separately.`;
    else if (/project|build|portfolio/.test(question)) {
      const project = context.nextTopics.find((topic) => topic.isProject);
      text = project
        ? `For “${project.title}”, define a small scope, build a working solution, test it, and document the setup and limitations. ${project.submitted ? 'Evidence is already submitted; complete the remaining project tasks when ready.' : 'Submit an HTTPS project link or descriptive notes in Learning logs before marking project tasks done.'}`
        : `There are ${context.projectsRemaining} required projects without a submission. Review your roadmap for the project brief, submit evidence in Learning logs, and complete the matching tasks separately.`;
    } else if (/streak|log|learned/.test(question))
      text = `Your current UTC learning streak is ${context.streak} days. Record what you learned and the minutes spent in Learning logs. Multiple sessions on a day add time without extending the streak. Logging time does not complete tasks automatically.`;
    else if (/next|today|start|stuck|help|explain|practice|learn/.test(question)) {
      const topic = context.nextTopics[0];
      text = topic
        ? `Focus next on “${topic.title}”${context.currentPhase ? ` in ${context.currentPhase}` : ''}. Review its roadmap resources, try one small exercise, and check your understanding by explaining the result. If stuck, reduce the exercise to one concept and record the specific question in your learning notes. Mark only the completed allocation in your weekly plan.`
        : 'Your topics are complete. Review your projects and learning notes, and check that all evidence has been submitted.';
    } else
      text =
        'I can offer offline guidance on your progress, next topic, study schedule, learning logs, and projects. Try “What should I work on next?” or “How am I doing?” Detailed AI explanations will be available after a provider is enabled.';
    for (const chunk of text.match(/.{1,48}(?:\s|$)|.{1,48}/gs) ?? []) {
      if (signal.aborted) throw new Error('Mentor cancelled');
      yield chunk;
    }
  }
}
