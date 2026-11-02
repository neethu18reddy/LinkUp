import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettings, saveSettings, studioKeys } from './studio.api';
export function useStudioSettings() {
  const client = useQueryClient(),
    attempted = useRef(false);
  const query = useQuery({ queryKey: studioKeys.settings, queryFn: getSettings });
  const save = useMutation({
    mutationFn: saveSettings,
    onSuccess: (data) => {
      client.setQueryData(studioKeys.settings, data);
      void client.invalidateQueries({ queryKey: studioKeys.overview });
      void client.invalidateQueries({ queryKey: ['studio-recap'] });
    },
  });
  const { mutate } = save;
  useEffect(() => {
    if (!query.data || query.data.timezoneConfirmed || attempted.current) return;
    attempted.current = true;
    mutate({ ...query.data, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
  }, [query.data, mutate]);
  return { query, save, ready: query.data?.timezoneConfirmed === true };
}
