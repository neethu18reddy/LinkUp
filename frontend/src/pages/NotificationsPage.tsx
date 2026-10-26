import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import {
  getNotifications,
  markNotificationRead,
  getNotificationPreferences,
  setNotificationPreferences,
} from '@/features/notifications/notifications.api';
export function NotificationsPage() {
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const notifications = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }) => getNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: false,
  });
  const preferences = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
    retry: false,
  });
  const read = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const save = useMutation({
    mutationFn: setNotificationPreferences,
    onSuccess: (data) => {
      client.setQueryData(['notification-preferences'], data);
      setMessage(
        data.remindersEnabled
          ? 'In-app reminders enabled.'
          : 'In-app reminders paused. Existing notifications stay in your inbox.',
      );
    },
  });
  const notices = notifications.data?.pages.flatMap((page) => page.notifications) ?? [];
  return (
    <AccountLayout>
      <main className="skills-page">
        <p className="eyebrow">Stay on track</p>
        <h1>Notifications</h1>
        <p>Weekly learning check-ins and gentle reminders when earlier work is unfinished.</p>
        <p className="field-hint">Reminders use UTC weeks. Email delivery is not connected.</p>
        <section className="skills-card" aria-label="Reminder preferences">
          <h2>Reminder preferences</h2>
          {preferences.isPending && <p role="status">Loading preferences…</p>}
          {preferences.isError && (
            <p role="alert">
              {requestError(preferences.error)}{' '}
              <Button onClick={() => void preferences.refetch()}>Retry preferences</Button>
            </p>
          )}
          {preferences.data && (
            <label>
              <input
                type="checkbox"
                checked={preferences.data.remindersEnabled}
                disabled={save.isPending}
                onChange={(event) => {
                  setMessage('');
                  save.mutate(event.target.checked);
                }}
              />{' '}
              Receive in-app learning reminders
            </label>
          )}
          {save.isError && <p role="alert">{requestError(save.error)}</p>}
          {message && <p role="status">{message}</p>}
        </section>
        {notifications.isPending && <p role="status">Loading notifications…</p>}
        {notifications.data && <p>{notifications.data.pages[0]!.unreadCount} unread</p>}
        {notifications.isError && (
          <p role="alert">
            {requestError(notifications.error)}{' '}
            <Button onClick={() => void notifications.refetch()}>Retry notifications</Button>
          </p>
        )}
        {read.isError && <p role="alert">{requestError(read.error)}</p>}
        {notifications.isSuccess && !notices.length && (
          <section className="skills-card">
            <h2>You’re all caught up</h2>
            <p>
              Reminders appear after the scheduled job checks an active learning plan. You can
              review your <Link to="/plan">weekly plan</Link> anytime.
            </p>
          </section>
        )}
        <div aria-label="Your notifications">
          {notices.map((notice) => (
            <article className="skills-card" key={notice.id}>
              <h2>{notice.title}</h2>
              <p>{notice.message}</p>
              <p className="field-hint">
                <time dateTime={notice.createdAt}>{notice.createdAt.slice(0, 10)} (UTC)</time> ·{' '}
                {notice.readAt ? 'Read' : 'Unread'}
              </p>
              <Link to="/plan">Review weekly plan</Link>{' '}
              {!notice.readAt && (
                <Button
                  variant="outline"
                  disabled={read.isPending}
                  onClick={() => read.mutate(notice.id)}
                >
                  Mark as read<span className="sr-only">: {notice.title}</span>
                </Button>
              )}
            </article>
          ))}
        </div>
        {notifications.hasNextPage && (
          <Button
            variant="outline"
            disabled={notifications.isFetchingNextPage}
            onClick={() => void notifications.fetchNextPage()}
          >
            {notifications.isFetchingNextPage ? 'Loading…' : 'Load older notifications'}
          </Button>
        )}
      </main>
    </AccountLayout>
  );
}
