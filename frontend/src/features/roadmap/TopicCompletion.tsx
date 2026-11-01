import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { requestError } from '@/lib/http';
export function TopicCompletion({
  id,
  title,
  status,
  project,
}: {
  id: string;
  title: string;
  status: string;
  project: boolean;
}) {
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      api.patch(`/topics/${encodeURIComponent(id)}`, {
        expectedStatus: status,
        complete: status !== 'DONE',
      }),
    onSettled: () => {
      for (const key of [
        'current-roadmap',
        'progress-summary',
        'my-skills',
        'career-matches',
        'plan',
      ])
        void client.invalidateQueries({ queryKey: [key] });
    },
  });
  return (
    <div className="topic-completion">
      <Button
        variant="outline"
        aria-label={`${status === 'DONE' ? 'Reopen' : 'Complete'} ${title}`}
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending
          ? 'Saving…'
          : status === 'DONE'
            ? 'Reopen topic'
            : project
              ? 'Complete milestone'
              : 'Mark complete'}
      </Button>
      {project && status !== 'DONE' && (
        <small>Submit project evidence in Learning logs first.</small>
      )}
      {save.error && <p role="alert">{requestError(save.error)}</p>}
    </div>
  );
}
