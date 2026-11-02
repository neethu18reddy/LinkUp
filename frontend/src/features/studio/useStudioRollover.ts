import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
export function useStudioRollover(nextRolloverAt?: string) {
  const client = useQueryClient();
  useEffect(() => {
    if (!nextRolloverAt) return;
    const refresh = () => {
      for (const key of ['studio-overview', 'studio-analytics', 'studio-recap'])
        void client.invalidateQueries({ queryKey: [key] });
    };
    const timer = setTimeout(refresh, Math.max(100, Date.parse(nextRolloverAt) - Date.now() + 100));
    return () => clearTimeout(timer);
  }, [nextRolloverAt, client]);
}
