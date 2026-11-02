import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { z } from 'zod';
import { requestError } from '@/lib/http';
export function useStudioDraft<T extends { id: string; version: number }>(
  storageKey: string,
  initial: T,
  schema: z.ZodType<T>,
  persist: (draft: T) => Promise<T>,
  onSaved: () => void,
) {
  const [starting] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = schema.safeParse(JSON.parse(raw));
        if (parsed.success) return { value: parsed.data, recovered: true };
      }
    } catch {
      /* unavailable storage */
    }
    return { value: initial, recovered: false };
  });
  const [draft, setDraft] = useState<T>(starting.value),
    [dirty, setDirty] = useState(starting.recovered),
    [online, setOnline] = useState(navigator.onLine),
    [localError, setLocalError] = useState('');
  const revision = useRef(0),
    currentId = useRef(starting.value.id);
  const save = useMutation({
    mutationFn: async ({ value, revision }: { value: T; revision: number }) => ({
      saved: await persist(value),
      revision,
      submitted: value,
    }),
    onSuccess: ({ saved, revision: sent, submitted }) => {
      onSaved();
      if (currentId.current !== saved.id) return;
      setDraft((current) =>
        revision.current === sent ? saved : { ...current, version: saved.version },
      );
      if (revision.current === sent) {
        setDirty(false);
        try {
          if (localStorage.getItem(storageKey) === JSON.stringify(submitted))
            localStorage.removeItem(storageKey);
        } catch {
          /* unavailable storage */
        }
      }
    },
  });
  const { mutate, isPending, isError, reset } = save;
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    if (dirty)
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {
        /* The event handler reports storage failures. */
      }
  }, [draft, dirty, storageKey]);
  useEffect(() => {
    if (!dirty || !online || isPending || isError) return;
    const timer = setTimeout(() => mutate({ value: draft, revision: revision.current }), 1100);
    return () => clearTimeout(timer);
  }, [draft, dirty, online, isPending, isError, mutate]);
  const change = (patch: Partial<T>) => {
    revision.current++;
    const value = { ...draft, ...patch };
    setDraft(value);
    setDirty(true);
    reset();
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
      setLocalError('');
    } catch {
      setLocalError('Local draft storage is unavailable. Keep this tab open or copy your draft.');
    }
  };
  const select = (value: T) => {
    if (dirty || isPending) return;
    currentId.current = value.id;
    revision.current++;
    setDraft(value);
    reset();
  };
  return {
    draft,
    change,
    select,
    dirty,
    pending: isPending,
    blocked: dirty || isPending,
    error: save.error ? requestError(save.error) : localError,
    status: !online
      ? 'Offline · draft kept on this device'
      : isPending
        ? 'Saving…'
        : dirty
          ? 'Draft saved on this device'
          : draft.version
            ? 'Saved'
            : 'Ready for your first idea',
    retry: () => mutate({ value: draft, revision: revision.current }),
    saveNow: async () =>
      (await save.mutateAsync({ value: draft, revision: revision.current })).saved,
  };
}
