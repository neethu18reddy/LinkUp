import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { clearLocalSession, refreshSession } from './auth.client';

export function SessionBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      useAuth.subscribe((state, previous) => {
        // Clear before the new account's queries mount, so its first fetch is not cancelled.
        if (state.user?.id !== previous.user?.id) queryClient.clear();
      }),
    [queryClient],
  );
  useEffect(() => {
    void refreshSession().catch(() => {
      /* Protected routes expose retry. */
    });
  }, []);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('linkup-session');
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === 'signed-out') clearLocalSession();
    };
    return () => channel.close();
  }, []);
  return children;
}
