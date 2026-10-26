import { createHash } from 'node:crypto';
import { AppError } from '../../utils/AppError.js';
import type { PlanRepository, PlanSnapshot } from './plan.repository.js';
import type { PlanSettings, SavePlan } from './plan.schemas.js';
import { schedulePlan } from './plan.scheduler.js';

export class PlanService {
  constructor(
    private repository: PlanRepository,
    private today = () => new Date().toISOString().slice(0, 10),
  ) {}
  private build(input: PlanSettings, snapshot: PlanSnapshot) {
    if ((snapshot.active?.id ?? null) !== input.expectedPlanId)
      throw new AppError(
        409,
        'PLAN_CHANGED',
        'Your active plan changed. Load the latest plan and preview again.',
      );
    const settings: PlanSettings = {
      roadmapId: input.roadmapId,
      hoursPerWeek: input.hoursPerWeek,
      flexibilityMode: input.flexibilityMode,
      startDate: snapshot.active ? this.today() : input.startDate,
      targetEndDate: input.targetEndDate,
      expectedPlanId: input.expectedPlanId,
    };
    if (settings.startDate < this.today())
      throw new AppError(422, 'START_DATE_PAST', 'Choose today or a future start date.');
    if (settings.startDate > `${Number(this.today().slice(0, 4)) + 2}${this.today().slice(4)}`)
      throw new AppError(422, 'START_DATE_TOO_LATE', 'Choose a start date within two years.');
    const schedule = schedulePlan(settings, snapshot.topics, snapshot.completed);
    const previewToken = createHash('sha256')
      .update(
        JSON.stringify({
          settings,
          topics: snapshot.topics,
          completed: snapshot.completed,
          schedule,
        }),
      )
      .digest('hex');
    return { settings, schedule, previewToken };
  }
  async current(userId: string, roadmapId: string) {
    return (await this.repository.snapshot(userId, roadmapId)).active;
  }
  async get(userId: string, id: string) {
    const plan = await this.repository.find(userId, id);
    if (!plan) throw new AppError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
    return plan;
  }
  async preview(userId: string, input: PlanSettings) {
    return this.build(input, await this.repository.snapshot(userId, input.roadmapId));
  }
  async save(userId: string, input: SavePlan) {
    return this.repository.commit(userId, input.roadmapId, (snapshot) => {
      const result = this.build(input, snapshot);
      if (result.previewToken !== input.previewToken)
        throw new AppError(
          409,
          'PREVIEW_EXPIRED',
          'Your progress or settings changed. Preview the plan again before confirming.',
        );
      return result;
    });
  }
  async replan(userId: string, id: string, input: SavePlan) {
    const previous = await this.get(userId, id);
    if (!previous.isActive || previous.roadmapId !== input.roadmapId || input.expectedPlanId !== id)
      throw new AppError(409, 'PLAN_CHANGED', 'Load and preview your latest plan.');
    return this.save(userId, input);
  }
}
