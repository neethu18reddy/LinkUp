import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { clearLocalSession, refreshSession } from './auth.client';

export function SessionBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.user?.id);
  useEffect(() => {
    void refreshSession().catch(() => {
      /* Protected routes expose retry. */
    });
  }, []);
  useEffect(() => {
    queryClient.clear();
  }, [queryClient, userId]);
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
