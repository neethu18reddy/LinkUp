import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  getProgress,
  getLogs,
  getProjects,
  addLog,
  submitProject,
} from '@/features/progress/progress.api';
import { progressFixture } from '@/test/progress-fixture';
import { ProgressPage } from './ProgressPage';
vi.mock('@/features/progress/progress.api', async (original) => ({
  ...(await original<typeof import('@/features/progress/progress.api')>()),
  getProgress: vi.fn(),
  getLogs: vi.fn(),
  getProjects: vi.fn(),
  addLog: vi.fn(),
  submitProject: vi.fn(),
}));
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
        <ProgressPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getProgress).mockResolvedValue(progressFixture());
  vi.mocked(getLogs).mockResolvedValue({ logs: [], nextCursor: null });
  vi.mocked(getProjects).mockResolvedValue([]);
  vi.mocked(addLog).mockResolvedValue({
    id: '70000000-0000-4000-8000-000000000001',
    requestId: crypto.randomUUID(),
    topicId: null,
    topicTitle: null,
    minutes: 30,
    note: 'Practice',
    loggedAt: new Date().toISOString(),
  });
  vi.mocked(submitProject).mockResolvedValue({
    id: crypto.randomUUID(),
    topicId: progressFixture().topics[1]!.id,
    title: 'App',
    repoUrl: null,
    notes: 'Practice project.',
    submittedAt: new Date().toISOString(),
  });
});
describe('Learning logs and projects', () => {
  it('loads an empty history and saves a general learning session', async () => {
    const user = userEvent.setup();
    mount();
    expect(await screen.findByText(/No learning logs yet/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('What did you learn?'), 'Practiced component state');
    await user.click(screen.getByRole('button', { name: 'Save learning log' }));
    expect(await screen.findByText('Learning log saved.')).toBeInTheDocument();
    expect(addLog).toHaveBeenCalledWith(
      expect.objectContaining({ topicId: null, minutes: 30, note: 'Practiced component state' }),
      expect.anything(),
    );
  });
  it('keeps the same request id and text when retrying a failed log', async () => {
    const user = userEvent.setup();
    vi.mocked(addLog).mockRejectedValueOnce(new Error('Connection lost'));
    mount();
    await user.type(await screen.findByLabelText('What did you learn?'), 'Practice React');
    await user.click(screen.getByRole('button', { name: 'Save learning log' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('What did you learn?')).toHaveValue('Practice React');
    await user.click(screen.getByRole('button', { name: 'Save learning log' }));
    await waitFor(() => expect(addLog).toHaveBeenCalledTimes(2));
    expect(vi.mocked(addLog).mock.calls[0]![0].requestId).toBe(
      vi.mocked(addLog).mock.calls[1]![0].requestId,
    );
  });
  it('submits project notes without completing tasks automatically', async () => {
    const user = userEvent.setup();
    mount();
    await user.selectOptions(
      await screen.findByLabelText('Project topic'),
      progressFixture().topics[1]!.id,
    );
    await user.type(screen.getByLabelText('Submission title'), 'Learning app');
    await user.type(screen.getByLabelText(/Notes \(at least/), 'Implemented and tested the app.');
    await user.click(screen.getByRole('button', { name: 'Save project submission' }));
    expect(await screen.findByText('Project submission saved.')).toBeInTheDocument();
    expect(submitProject).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Learning app', repoUrl: null }),
      expect.anything(),
    );
  });
  it('retries failed history loading', async () => {
    const user = userEvent.setup();
    vi.mocked(getLogs).mockRejectedValueOnce(new Error('Unavailable'));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Retry logs' }));
    expect(await screen.findByText(/No learning logs yet/)).toBeInTheDocument();
  });
  it('loads older history using the server cursor', async () => {
    const user = userEvent.setup();
    const cursor = crypto.randomUUID();
    vi.mocked(getLogs)
      .mockResolvedValueOnce({ logs: [], nextCursor: cursor })
      .mockResolvedValue({ logs: [], nextCursor: null });
    mount();
    await user.click(await screen.findByRole('button', { name: 'Load older logs' }));
    await waitFor(() => expect(getLogs).toHaveBeenCalledWith(cursor));
  });
  it('offers topic-load retry and keeps history readable', async () => {
    const user = userEvent.setup();
    vi.mocked(getProgress).mockRejectedValueOnce(new Error('Unavailable'));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Retry topics' }));
    expect(await screen.findByLabelText('Topic (optional)')).toBeInTheDocument();
  });
});
