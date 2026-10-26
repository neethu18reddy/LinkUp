import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  getNotifications,
  getNotificationPreferences,
  markNotificationRead,
  setNotificationPreferences,
} from '@/features/notifications/notifications.api';
import { NotificationsPage } from './NotificationsPage';
vi.mock('@/features/notifications/notifications.api', () => ({
  getNotifications: vi.fn(),
  getNotificationPreferences: vi.fn(),
  markNotificationRead: vi.fn(),
  setNotificationPreferences: vi.fn(),
}));
const notice = {
  id: '12345678-1234-4234-8234-123456789012',
  type: 'WEEKLY_REMINDER' as const,
  title: 'Your weekly learning check-in',
  message: 'Review your weekly plan.',
  createdAt: '2026-10-27T08:00:00.000Z',
  readAt: null,
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
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getNotifications).mockResolvedValue({
    notifications: [notice],
    unreadCount: 1,
    nextCursor: null,
  });
  vi.mocked(getNotificationPreferences).mockResolvedValue({ remindersEnabled: true });
  vi.mocked(markNotificationRead).mockResolvedValue(undefined);
  vi.mocked(setNotificationPreferences).mockResolvedValue({ remindersEnabled: false });
});
describe('notification inbox', () => {
  it('shows unread notices and marks them read after saving', async () => {
    mount();
    const button = await screen.findByRole('button', { name: /Mark as read/ }, { timeout: 5000 });
    expect(screen.getByText('1 unread')).toBeInTheDocument();
    vi.mocked(getNotifications).mockResolvedValue({
      notifications: [{ ...notice, readAt: notice.createdAt }],
      unreadCount: 0,
      nextCursor: null,
    });
    await userEvent.click(button);
    expect(markNotificationRead).toHaveBeenCalledWith(notice.id, expect.anything());
    expect(await screen.findByText('0 unread')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark as read/ })).not.toBeInTheDocument();
  });
  it('saves an opt-out and keeps existing messages visible', async () => {
    mount();
    const checkbox = await screen.findByRole(
      'checkbox',
      { name: 'Receive in-app learning reminders' },
      { timeout: 5000 },
    );
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(setNotificationPreferences).toHaveBeenCalledWith(false, expect.anything());
    expect(screen.getByText('Your weekly learning check-in')).toBeInTheDocument();
  });
  it('shows the empty inbox and supports fetching older pages', async () => {
    vi.mocked(getNotifications)
      .mockResolvedValueOnce({ notifications: [], unreadCount: 0, nextCursor: notice.id })
      .mockResolvedValueOnce({ notifications: [notice], unreadCount: 1, nextCursor: null });
    mount();
    expect(
      await screen.findByText('You’re all caught up', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load older notifications' }));
    expect(await screen.findByText(notice.title)).toBeInTheDocument();
    expect(getNotifications).toHaveBeenLastCalledWith(notice.id);
  });
  it('keeps a failed preference update unchanged and offers inbox retry', async () => {
    vi.mocked(getNotifications).mockRejectedValue(new Error('network failure'));
    vi.mocked(setNotificationPreferences).mockRejectedValue(new Error('save failed'));
    mount();
    const checkbox = await screen.findByRole('checkbox', {}, { timeout: 5000 });
    await userEvent.click(checkbox);
    await waitFor(() => expect(checkbox).toBeEnabled());
    expect(checkbox).toBeChecked();
    expect(screen.getByRole('button', { name: 'Retry notifications' })).toBeInTheDocument();
  });
});
