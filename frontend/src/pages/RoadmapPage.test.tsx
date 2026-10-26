import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { getCurrentRoadmap, generateRoadmap } from '@/features/roadmap/roadmap.api';
import { RoadmapPage } from './RoadmapPage';
vi.mock('@/features/roadmap/roadmap.api', async (original) => ({
  ...(await original<typeof import('@/features/roadmap/roadmap.api')>()),
  getCurrentRoadmap: vi.fn(),
  generateRoadmap: vi.fn(),
}));
const data = {
  goalId: '10000000-0000-4000-8000-000000000001',
  analysis: {
    gaps: [
      {
        skillId: '00000000-0000-4000-8000-000000000005',
        name: 'React',
        currentLevel: null,
        requiredLevel: 'INTERMEDIATE',
        weight: 3,
        score: 6,
      },
    ],
    strengths: [],
  },
  roadmap: null,
  provider: 'template',
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
        <RoadmapPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentRoadmap).mockResolvedValue(data);
});
describe('Roadmap page', () => {
  it('shows a saved roadmap with numeric hours and safe resource links', async () => {
    vi.mocked(getCurrentRoadmap).mockResolvedValue({
      ...data,
      roadmap: {
        id: '20000000-0000-4000-8000-000000000001',
        goalId: data.goalId,
        title: 'React learning roadmap',
        version: 2,
        generationSource: 'template',
        totalEstimatedHours: 18,
        phases: [
          {
            id: 'phase',
            title: 'Practice React',
            description: 'Apply the fundamentals.',
            topics: [
              {
                id: 'topic',
                title: 'Build a small app',
                subtopics: ['Use state'],
                estimatedHours: 18,
                difficulty: 'INTERMEDIATE',
                isProject: true,
                resources: [{ title: 'React docs', url: 'https://react.dev/learn' }],
              },
            ],
          },
        ],
      },
    });
    mount();
    expect(await screen.findByText('React learning roadmap')).toBeInTheDocument();
    expect(screen.getByText(/Version 2/)).toHaveTextContent('18 estimated hours');
    expect(screen.getByRole('link', { name: 'React docs' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });
  it('announces a saved fallback and refreshes the roadmap after generation', async () => {
    const user = userEvent.setup();
    vi.mocked(generateRoadmap).mockResolvedValue({
      roadmap: {
        id: '20000000-0000-4000-8000-000000000001',
        goalId: data.goalId,
        title: 'Saved fallback',
        version: 1,
        generationSource: 'template-fallback',
        totalEstimatedHours: 10,
        phases: [],
      },
      notice: 'AI was unavailable. A curated template was saved.',
    });
    mount();
    await user.click(await screen.findByRole('button', { name: 'Generate roadmap' }));
    await user.click(screen.getByRole('button', { name: 'Confirm generation' }));
    expect(await screen.findByRole('status')).toHaveTextContent('A curated template was saved.');
    await waitFor(() => expect(getCurrentRoadmap).toHaveBeenCalledTimes(2));
  });
  it('shows loading before the saved gaps', async () => {
    vi.mocked(getCurrentRoadmap).mockReturnValue(new Promise(() => {}));
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('Comparing');
  });
  it('requires review and confirmation before consuming an attempt', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Generate roadmap' }));
    expect(generateRoadmap).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(generateRoadmap).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Generate roadmap' }));
    vi.mocked(generateRoadmap).mockReturnValue(new Promise(() => {}));
    await user.click(screen.getByRole('button', { name: 'Confirm generation' }));
    expect(generateRoadmap).toHaveBeenCalledWith(data.goalId, expect.anything());
    expect(screen.getByRole('status')).toHaveTextContent('Building');
  });
  it('surfaces quota errors and keeps review available for retry', async () => {
    const user = userEvent.setup();
    vi.mocked(generateRoadmap).mockRejectedValue(new Error('Quota reached'));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Generate roadmap' }));
    await user.click(screen.getByRole('button', { name: 'Confirm generation' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Confirm generation' })).toBeEnabled();
  });
  it('retries a failed context load and links to goal selection', async () => {
    const user = userEvent.setup();
    vi.mocked(getCurrentRoadmap).mockRejectedValueOnce(new Error('Choose a goal'));
    mount();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review your goal' })).toHaveAttribute(
      'href',
      '/goals',
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Where to focus')).toBeInTheDocument();
  });
});
