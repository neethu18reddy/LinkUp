import { AppError } from '../../utils/AppError.js';
import type { ProgressRepository } from './progress.types.js';
import type { LogInput, ProjectInput, TaskInput } from './progress.schemas.js';
import { summarizeProgress } from './progress.logic.js';
export class ProgressService {
  constructor(
    private repository: ProgressRepository,
    private now = () => new Date(),
  ) {}
  async summary(userId: string, roadmapId?: string) {
    const now = this.now();
    return summarizeProgress(
      await this.repository.snapshot(userId, roadmapId, now),
      now.toISOString().slice(0, 10),
    );
  }
  updateTask(userId: string, id: string, input: TaskInput) {
    return this.repository.updateTask(userId, id, input);
  }
  addLog(userId: string, input: LogInput) {
    const today = this.now().toISOString().slice(0, 10);
    const oldest = new Date(Date.parse(today) - 365 * 86400000).toISOString().slice(0, 10);
    if (input.loggedOn > today || input.loggedOn < oldest)
      throw new AppError(
        422,
        'INVALID_LOG_DATE',
        'Choose a date from the past year through today (UTC).',
      );
    return this.repository.addLog(userId, input);
  }
  logs(userId: string, limit: number, cursor?: string) {
    return this.repository.logs(userId, limit, cursor);
  }
  submitProject(userId: string, input: ProjectInput) {
    return this.repository.submitProject(userId, input);
  }
  projects(userId: string, roadmapId: string) {
    return this.repository.projects(userId, roadmapId);
  }
}
