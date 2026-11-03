import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { StudyPlanForm } from './StudyPlanForm';
import type { PlanningPreferences, StudySchedule } from './youtube.api';
describe('YouTube study plan review', () => {
  it('requires a fresh preview after preference changes and saves confirmed preferences', async () => {
    const initial: PlanningPreferences = {
      goal: 'Learn arrays',
      level: 'beginner',
      language: 'both',
      timezone: 'Asia/Kolkata',
      dailyMinutes: 20,
      weekdays: [1, 2, 3, 4, 5],
      startDate: '2026-11-04',
      targetDate: null,
      estimates: {},
    };
    const schedule: StudySchedule = {
      days: [{ date: '2026-11-04', minutes: 20, tasks: [] }],
      completionDate: '2026-11-04',
      totalMinutes: 20,
      warning: null,
      basis: 'Based on metadata.',
    };
    const build = vi.fn().mockResolvedValue(schedule),
      save = vi.fn().mockResolvedValue({});
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <StudyPlanForm initial={initial} unknownItems={[]} build={build} save={save} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    expect(screen.queryByRole('button', { name: 'Save study plan' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Preview study schedule' }));
    await screen.findByRole('button', { name: 'Save study plan' });
    await user.clear(screen.getByLabelText('Minutes per study day'));
    await user.type(screen.getByLabelText('Minutes per study day'), '30');
    expect(screen.queryByRole('button', { name: 'Save study plan' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Preview study schedule' }));
    await screen.findByRole('button', { name: 'Save study plan' });
    await user.click(screen.getByRole('button', { name: 'Save study plan' }));
    await screen.findByText('Study plan saved.');
    expect(save.mock.calls[0]![0]).toEqual({ ...initial, dailyMinutes: 30 });
  });
});
