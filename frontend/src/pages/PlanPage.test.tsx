import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { getCurrentRoadmap } from '@/features/roadmap/roadmap.api';
import {
  getCurrentPlan,
  previewPlan,
  savePlan,
  type Plan,
  type PlanPreview,
} from '@/features/plan/plan.api';
import { PlanPage } from './PlanPage';
vi.mock('@/features/roadmap/roadmap.api', async (original) => ({
  ...(await original<typeof import('@/features/roadmap/roadmap.api')>()),
  getCurrentRoadmap: vi.fn(),
}));
vi.mock('@/features/plan/plan.api', async (original) => ({
  ...(await original<typeof import('@/features/plan/plan.api')>()),
  getCurrentPlan: vi.fn(),
  previewPlan: vi.fn(),
  savePlan: vi.fn(),
}));
const roadmapId = '20000000-0000-4000-8000-000000000001';
const date = new Date().toISOString().slice(0, 10);
const roadmap = {
  goalId: '10000000-0000-4000-8000-000000000001',
  analysis: { gaps: [], strengths: [] },
  provider: 'template',
  roadmap: {
    id: roadmapId,
    goalId: '10000000-0000-4000-8000-000000000001',
    title: 'Learning path',
    version: 1,
    generationSource: 'template',
    totalEstimatedHours: 10,
    phases: [],
  },
};
const preview: PlanPreview = {
  settings: {
    roadmapId,
    hoursPerWeek: 5,
    flexibilityMode: 'STANDARD',
    startDate: date,
    targetEndDate: null,
    expectedPlanId: null,
  },
  previewToken: 'a'.repeat(64),
  schedule: {
    projectedEndDate: '2027-01-01',
    effectiveHoursPerWeek: 5,
    remainingHours: 10,
    warnings: [],
    weeks: [],
  },
};
const saved: Plan = {
  ...preview.settings,
  id: '30000000-0000-4000-8000-000000000001',
  version: 1,
  isActive: true,
  projectedEndDate: '2027-01-01',
  weeks: [],
};
function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <MemoryRouter>
        <PlanPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentRoadmap).mockResolvedValue(roadmap);
  vi.mocked(getCurrentPlan).mockResolvedValue(null);
  vi.mocked(previewPlan).mockResolvedValue(preview);
  vi.mocked(savePlan).mockResolvedValue(saved);
});
describe('Weekly plan', () => {
  it('guides a learner without a goal instead of offering an ineffective retry', async () => {
    const error = new AxiosError('Goal required');
    error.response = {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { error: { code: 'GOAL_REQUIRED', message: 'Choose a goal first.' } },
    };
    vi.mocked(getCurrentRoadmap).mockRejectedValue(error);
    mount();
    expect(
      await screen.findByRole('link', { name: 'Choose your goal' }, { timeout: 5000 }),
    ).toHaveAttribute('href', '/goals');
    expect(screen.queryByRole('button', { name: 'Retry roadmap' })).not.toBeInTheDocument();
    expect(getCurrentPlan).not.toHaveBeenCalled();
  });
  it('shows what is scheduled before a plan is confirmed', async () => {
    vi.mocked(previewPlan).mockResolvedValue({
      ...preview,
      schedule: {
        ...preview.schedule,
        weeks: [
          {
            weekNumber: 1,
            startDate: date,
            plannedHours: 5,
            focusSummary: 'Practice Python fundamentals',
            isBuffer: false,
            items: [],
          },
        ],
      },
    });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Preview plan' }));
    expect(await screen.findByText('Practice Python fundamentals')).toBeInTheDocument();
    expect(savePlan).not.toHaveBeenCalled();
  });
  it('shows loading and an actionable empty roadmap state', async () => {
    vi.mocked(getCurrentRoadmap).mockResolvedValue({ ...roadmap, roadmap: null });
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(await screen.findByRole('link', { name: 'Open roadmap' })).toHaveAttribute(
      'href',
      '/roadmap',
    );
    expect(getCurrentPlan).not.toHaveBeenCalled();
  });
  it('previews before confirming and preserves settings when cancelling', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Preview plan' }));
    expect(await screen.findByText('2027-01-01')).toBeInTheDocument();
    expect(savePlan).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Confirm plan' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Hours per week')).toHaveValue(5);
    await user.click(screen.getByRole('button', { name: 'Preview plan' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm plan' }));
    expect(await screen.findByText('Your weekly plan is saved.')).toBeInTheDocument();
    expect(savePlan).toHaveBeenCalledTimes(1);
  });
  it('invalidates a preview after editing settings', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Preview plan' }));
    await screen.findByRole('button', { name: 'Confirm plan' });
    await user.selectOptions(screen.getByLabelText('Flexibility'), 'RELAXED');
    expect(screen.queryByRole('button', { name: 'Confirm plan' })).not.toBeInTheDocument();
    expect(savePlan).not.toHaveBeenCalled();
  });
  it('shows required deadline and workload warnings', async () => {
    const user = userEvent.setup();
    vi.mocked(previewPlan).mockResolvedValue({
      ...preview,
      schedule: {
        ...preview.schedule,
        warnings: ['More than 40 study hours per week may be difficult to sustain.'],
      },
    });
    mount();
    await user.selectOptions(await screen.findByLabelText('Flexibility'), 'DEADLINE');
    expect(screen.getByLabelText('Deadline')).toBeRequired();
    await user.type(screen.getByLabelText('Deadline'), '2027-01-01');
    await user.click(screen.getByRole('button', { name: 'Preview plan' }));
    expect(await screen.findByText(/More than 40/)).toBeInTheDocument();
  });
  it('requires another preview after a failed confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(savePlan).mockRejectedValue(new Error('Plan changed'));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Preview plan' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm plan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Preview again');
    expect(screen.queryByRole('button', { name: 'Confirm plan' })).not.toBeInTheDocument();
  });
  it('reviews a replan while preserving completed work', async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentPlan).mockResolvedValue(saved);
    vi.mocked(previewPlan).mockResolvedValue({
      ...preview,
      settings: { ...preview.settings, expectedPlanId: saved.id },
    });
    mount();
    await user.click(await screen.findByRole('button', { name: 'Preview plan' }));
    expect(await screen.findByText(/Completed allocations/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Start date')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm replan' }));
    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(1));
  });
  it('retries plan loading without losing the roadmap', async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentPlan).mockRejectedValueOnce(new Error('Database unavailable'));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Retry plan' }));
    expect(await screen.findByRole('button', { name: 'Preview plan' })).toBeInTheDocument();
  });
});
