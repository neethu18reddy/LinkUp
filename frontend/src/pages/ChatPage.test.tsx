import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  getSessions,
  getHistory,
  deleteHistory,
  streamMessage,
  MentorError,
} from '@/features/chat/chat.api';
import { chatSession, chatMessages } from '@/test/chat-fixture';
import { ChatPage } from './ChatPage';
vi.mock('@/features/chat/chat.api', async (original) => ({
  ...(await original<typeof import('@/features/chat/chat.api')>()),
  getSessions: vi.fn(),
  getHistory: vi.fn(),
  deleteHistory: vi.fn(),
  streamMessage: vi.fn(),
}));
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
        <ChatPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSessions).mockResolvedValue([]);
  vi.mocked(getHistory).mockResolvedValue({
    session: chatSession,
    messages: chatMessages,
    nextBefore: null,
  });
  vi.mocked(deleteHistory).mockResolvedValue(undefined);
  vi.mocked(streamMessage).mockImplementation(async (input, _signal, onEvent) => {
    onEvent({ event: 'meta', data: { session: { ...chatSession, version: 0 }, mode: 'offline' } });
    onEvent({ event: 'delta', data: { text: chatMessages[1]!.content } });
    onEvent({
      event: 'done',
      data: {
        session: chatSession,
        messages: chatMessages.map((message) => ({ ...message, requestId: input.requestId })),
      },
    });
  });
});
describe('Mentor conversation UI', () => {
  it('ignores an earlier-history response after switching conversations', async () => {
    const user = userEvent.setup(),
      second = {
        ...chatSession,
        id: '80000000-0000-4000-8000-000000000002',
        version: 0,
        title: 'Second conversation',
      };
    vi.mocked(getSessions).mockResolvedValue([chatSession, second]);
    let resolveEarlier!: (value: Awaited<ReturnType<typeof getHistory>>) => void;
    vi.mocked(getHistory).mockImplementation(async (id, before) => {
      if (id === second.id) return { session: second, messages: [], nextBefore: null };
      if (before)
        return new Promise((resolve) => {
          resolveEarlier = resolve;
        });
      return { session: chatSession, messages: chatMessages, nextBefore: 1 };
    });
    mount();
    await user.click(
      await screen.findByRole('button', { name: 'Load earlier messages' }, { timeout: 5000 }),
    );
    await user.selectOptions(screen.getByLabelText('Conversation'), second.id);
    await act(async () =>
      resolveEarlier({
        session: chatSession,
        messages: [
          { ...chatMessages[0]!, id: crypto.randomUUID(), content: 'Earlier private conversation' },
        ],
        nextBefore: null,
      }),
    );
    expect(screen.queryByText('Earlier private conversation')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Conversation')).toHaveValue(second.id);
  });
  it('labels offline mode and fills suggestions without sending automatically', async () => {
    const user = userEvent.setup();
    mount();
    expect(screen.getByText(/Offline guidance is active/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'What should I work on next?' }));
    expect(screen.getByLabelText('Your learning question')).toHaveValue(
      'What should I work on next?',
    );
    expect(streamMessage).not.toHaveBeenCalled();
  });
  it('streams a reply and shows the saved turn', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'What should I work on next?' }));
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText(chatMessages[1]!.content)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Copy reply' })).toBeInTheDocument();
    expect(screen.queryByText('Mentor · unsaved reply')).not.toBeInTheDocument();
  });
  it('restores saved history on load', async () => {
    vi.mocked(getSessions).mockResolvedValue([chatSession]);
    mount();
    expect(await screen.findByText(chatMessages[1]!.content)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Conversation' })).toHaveValue(chatSession.id);
  });
  it('reuses the request id when retrying a failed stream', async () => {
    const user = userEvent.setup();
    vi.mocked(streamMessage).mockRejectedValueOnce(new MentorError('Network interrupted'));
    mount();
    await user.click(await screen.findByRole('button', { name: 'What should I work on next?' }));
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network interrupted');
    await user.click(screen.getByRole('button', { name: 'Retry message' }));
    await waitFor(() => expect(streamMessage).toHaveBeenCalledTimes(2));
    expect(vi.mocked(streamMessage).mock.calls[0]![0].requestId).toBe(
      vi.mocked(streamMessage).mock.calls[1]![0].requestId,
    );
  });
  it('supports stopping a reply and aborts when unmounted', async () => {
    const user = userEvent.setup();
    let captured: AbortSignal | undefined;
    vi.mocked(streamMessage).mockImplementation((_input, signal) => {
      captured = signal;
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        }),
      );
    });
    const mounted = mount();
    await user.click(await screen.findByRole('button', { name: 'How am I doing?' }));
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await user.click(await screen.findByRole('button', { name: 'Stop reply' }));
    expect(captured!.aborted).toBe(true);
    expect(await screen.findByRole('alert')).toHaveTextContent('Stopped');
    mounted.unmount();
  });
  it('requires explicit confirmation before deleting a conversation', async () => {
    const user = userEvent.setup();
    vi.mocked(getSessions).mockResolvedValue([chatSession]);
    mount();
    await user.click(await screen.findByRole('button', { name: 'Delete conversation' }));
    expect(deleteHistory).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(deleteHistory).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete conversation' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() =>
      expect(deleteHistory).toHaveBeenCalledWith(chatSession.id, expect.anything()),
    );
  });
  it('retries failed session loading', async () => {
    const user = userEvent.setup();
    vi.mocked(getSessions).mockRejectedValueOnce(new Error('Unavailable'));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Retry conversations' }));
    expect(await screen.findByRole('button', { name: 'How am I doing?' })).toBeEnabled();
  });
});
