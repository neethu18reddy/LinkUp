import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { RoadmapJourney } from './RoadmapJourney';
import { getSkillProgress } from '@/features/studio/studio.api';
vi.mock('@/features/studio/useStudioSettings', () => ({
  useStudioSettings: () => ({ ready: false, query: {} }),
}));
vi.mock('@/features/studio/studio.api', async (original) => ({
  ...(await original<typeof import('@/features/studio/studio.api')>()),
  getSkillProgress: vi.fn(),
}));
it('keeps a higher-proficiency step open when earlier learning of that skill is complete', async () => {
  const skillId = '00000000-0000-4000-8000-000000000005';
  vi.mocked(getSkillProgress).mockResolvedValue({
    progress: [
      {
        skillId,
        status: 'DONE',
        percent: 100,
        source: 'MANUAL',
        manualComplete: true,
        beforeTracking: false,
      },
    ],
    links: [],
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <RoadmapJourney
          data={{
            goalId: 'goal',
            provider: 'template',
            analysis: { gaps: [], strengths: [] },
            roadmap: {
              id: 'roadmap',
              goalId: 'goal',
              title: 'Advanced practice',
              version: 2,
              generationSource: 'template',
              totalEstimatedHours: 10,
              phases: [
                {
                  id: 'phase',
                  title: 'Advanced stage',
                  description: 'Raise the bar.',
                  topics: [
                    {
                      id: 'topic',
                      skillId,
                      title: 'Advanced React',
                      subtopics: ['Practice advanced patterns'],
                      estimatedHours: 10,
                      difficulty: 'ADVANCED',
                      status: 'TODO',
                      isProject: false,
                      resources: [],
                    },
                  ],
                },
              ],
            },
          }}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('button', { name: 'Complete Advanced React' })).toBeEnabled();
  expect(screen.getByRole('progressbar', { name: 'Roadmap completion' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  expect(screen.getByText('Up next')).toBeInTheDocument();
});
