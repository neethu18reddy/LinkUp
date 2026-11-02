import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { requestError } from '@/lib/http';
import { toast } from 'sonner';
import type { z } from 'zod';
import { roadmapKey, type currentRoadmapSchema } from './roadmap.api';
type CurrentRoadmap = z.infer<typeof currentRoadmapSchema>;
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
    mutationFn: (input: { expectedStatus: string; complete: boolean }) =>
      api.patch(`/topics/${encodeURIComponent(id)}`, input),
    onMutate: async (input) => {
      if (project) return {};
      await client.cancelQueries({ queryKey: roadmapKey });
      const previous = client.getQueryData<CurrentRoadmap>(roadmapKey);
      if (previous?.roadmap)
        client.setQueryData<CurrentRoadmap>(roadmapKey, {
          ...previous,
          roadmap: {
            ...previous.roadmap,
            phases: previous.roadmap.phases.map((phase) => ({
              ...phase,
              topics: phase.topics.map((topic) =>
                topic.id === id ? { ...topic, status: input.complete ? 'DONE' : 'TODO' } : topic,
              ),
            })),
          },
        });
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) client.setQueryData(roadmapKey, context.previous);
      toast.error(requestError(error));
    },
    onSettled: () => {
      for (const key of [
        'current-roadmap',
        'progress-summary',
        'my-skills',
        'career-matches',
        'plan',
        'studio-skills',
        'studio-overview',
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
        onClick={() => save.mutate({ expectedStatus: status, complete: status !== 'DONE' })}
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
