import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { getProgress, updateTask } from './progress.api';
import { progressFixture } from '@/test/progress-fixture';
import { DashboardProgress } from './DashboardProgress';
vi.mock('./progress.api', async (original) => ({
  ...(await original<typeof import('./progress.api')>()),
  getProgress: vi.fn(),
  updateTask: vi.fn(),
}));
vi.mock('./ProgressCharts', () => ({ ProgressCharts: () => <p>Progress charts ready</p> }));
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
        <DashboardProgress />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getProgress).mockResolvedValue(progressFixture());
  vi.mocked(updateTask).mockResolvedValue({});
});
describe('Progress dashboard', () => {
  it('shows progress, streak, milestone and current-week tasks', async () => {
    mount();
    expect(await screen.findByText('25%')).toBeInTheDocument();
    expect(screen.getByText('2 days')).toBeInTheDocument();
    expect(screen.getByText(/Next milestone: Foundations/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Complete React basics' })).not.toBeChecked();
  });
  it('sends the current status and refreshes progress after completing a task', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: 'Complete React basics' }));
    await waitFor(() =>
      expect(updateTask).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'DONE', expectedStatus: 'TODO' }),
        expect.anything(),
      ),
    );
    await waitFor(() => expect(getProgress).toHaveBeenCalledTimes(2));
  });
  it('surfaces project/ownership errors without showing a false completion', async () => {
    const user = userEvent.setup();
    vi.mocked(updateTask).mockRejectedValue(new Error('Submit a project'));
    mount();
    await user.click(await screen.findByRole('checkbox', { name: 'Complete React basics' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Complete React basics' })).not.toBeChecked();
  });
  it('shows overdue hours and an actionable empty state', async () => {
    vi.mocked(getProgress).mockResolvedValue({
      ...progressFixture(),
      behindSchedule: true,
      overdueHours: 3,
    });
    mount();
    expect(await screen.findByText(/3 estimated hours remain/)).toBeInTheDocument();
  });
  it('recovers from a failed summary request', async () => {
    const user = userEvent.setup();
    vi.mocked(getProgress).mockRejectedValueOnce(new Error('Unavailable'));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Retry progress' }));
    expect(await screen.findByText('25%')).toBeInTheDocument();
  });
  it('guides a learner who has no roadmap or plan', async () => {
    vi.mocked(getProgress).mockResolvedValue({
      ...progressFixture(),
      roadmap: null,
      currentWeek: null,
      topics: [],
      skills: [],
    });
    mount();
    expect(await screen.findByRole('link', { name: 'generate a roadmap' })).toHaveAttribute(
      'href',
      '/roadmap',
    );
  });
});
