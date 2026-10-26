import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestError } from '@/lib/http';
import { updateTask, progressKey, type TaskStatus } from './progress.api';
export function TaskControl({
  id,
  title,
  status,
}: {
  id: string;
  title: string;
  status: TaskStatus;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: updateTask,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: progressKey }),
        client.invalidateQueries({ queryKey: ['plan'] }),
        client.invalidateQueries({ queryKey: ['current-roadmap'] }),
      ]);
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: progressKey });
      void client.invalidateQueries({ queryKey: ['plan'] });
    },
  });
  const change = (value: TaskStatus) =>
    mutation.mutate({ id, status: value, expectedStatus: status });
  return (
    <span className="task-control">
      <label>
        <input
          type="checkbox"
          aria-label={`Complete ${title}`}
          checked={status === 'DONE'}
          disabled={mutation.isPending}
          onChange={(event) => change(event.target.checked ? 'DONE' : 'TODO')}
        />{' '}
        Done
      </label>{' '}
      <select
        aria-label={`Status for ${title}`}
        value={status}
        disabled={mutation.isPending}
        onChange={(event) => change(event.target.value as TaskStatus)}
      >
        <option value="TODO">To do</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="DONE">Done</option>
        <option value="SKIPPED">Skipped</option>
      </select>
      {mutation.isError && (
        <span role="alert">
          {requestError(mutation.error)} <Link to="/progress">Logs and projects</Link>
        </span>
      )}
    </span>
  );
}
