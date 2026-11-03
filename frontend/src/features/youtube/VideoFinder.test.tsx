import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { VideoFinder } from './VideoFinder';
import { findVideos, getVideoComments, getYouTubePreference } from './youtube.api';
vi.mock('./youtube.api', async (original) => ({
  ...(await original<typeof import('./youtube.api')>()),
  findVideos: vi.fn(),
  getVideoComments: vi.fn(),
  getYouTubePreference: vi.fn(),
}));
const video = {
  id: 'aaaaaaaaaaa',
  title: 'JavaScript arrays',
  channel: 'Teaching channel',
  url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
  thumbnailUrl: null,
  publishedAt: '2026-01-01T00:00:00Z',
  durationSec: 600,
  views: '10000',
  likes: null,
  comments: null,
  language: null,
  languageVerified: false,
};
function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <MemoryRouter>
        <VideoFinder initialTopic="JavaScript arrays" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getYouTubePreference).mockResolvedValue({ language: 'both' });
  vi.mocked(findVideos).mockResolvedValue({
    videos: [video],
    cached: false,
    fetchedAt: '2026-11-04T00:00:00Z',
  });
  vi.mocked(getVideoComments).mockResolvedValue({
    comments: [
      {
        id: 'one',
        text: '<script>unsafe()</script> Useful lesson.',
        author: 'Learner',
        likes: 2,
        url: video.url,
      },
    ],
    unavailable: false,
    cached: false,
  });
});
describe('topic video finder', () => {
  it('searches only on request using the saved language and preserves missing statistics', async () => {
    mount();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByLabelText('Preferred language')).toHaveValue('both'));
    expect(findVideos).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Find videos' }));
    await screen.findByRole('heading', { name: 'JavaScript arrays' });
    expect(vi.mocked(findVideos).mock.calls[0]![0]).toEqual({
      topic: 'JavaScript arrays',
      language: 'both',
      level: 'beginner',
      order: 'relevance',
    });
    expect(screen.getAllByText('Not provided')).toHaveLength(2);
    expect(getVideoComments).not.toHaveBeenCalled();
    expect(
      screen.getByRole('link', { name: 'Build my study plan' }).getAttribute('href'),
    ).toContain('/youtube?url=');
    await user.click(screen.getByRole('button', { name: 'Show top comments' }));
    await screen.findByText('<script>unsafe()</script> Useful lesson.');
    expect(document.querySelector('.youtube-comments script')).toBeNull();
    expect(getVideoComments).toHaveBeenCalledTimes(1);
  });
  it('shows quota errors without fabricating results', async () => {
    vi.mocked(findVideos).mockRejectedValue(new Error('Search unavailable'));
    mount();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Find videos' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Find videos' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('link', { name: 'Build my study plan' })).not.toBeInTheDocument();
  });
});
