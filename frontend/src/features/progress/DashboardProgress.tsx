import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { getProgress, progressKey } from './progress.api';
import { TaskControl } from './TaskControl';
const Charts = lazy(() =>
  import('./ProgressCharts').then((module) => ({ default: module.ProgressCharts })),
);
export function DashboardProgress() {
  const query = useQuery({ queryKey: progressKey, queryFn: getProgress });
  if (query.isPending) return <p role="status">Loading your progress…</p>;
  if (query.isError)
    return (
      <section className="skills-card">
        <p role="alert">{requestError(query.error)}</p>
        <Button onClick={() => void query.refetch()}>Retry progress</Button>
      </section>
    );
  const data = query.data;
  return (
    <>
      <section className="skills-card">
        <h2>{data.roadmap?.title ?? 'Your next step'}</h2>
        {data.roadmap ? (
          <>
            <div className="progress-metrics">
              <div>
                <div
                  className="progress-ring"
                  role="progressbar"
                  aria-label="Overall progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={data.overallPercent}
                  style={{
                    background: `conic-gradient(#285b46 ${data.overallPercent}%, #e0e6e1 0)`,
                  }}
                >
                  <strong>{data.overallPercent}%</strong>
                </div>
                <p>Overall progress</p>
                <p>
                  {data.completedHours} of {data.totalHours} estimated hours completed
                </p>
              </div>
              <div>
                <strong>
                  {data.streak} {data.streak === 1 ? 'day' : 'days'}
                </strong>
                <p>Learning streak (UTC)</p>
              </div>
              <div>
                <strong>{data.loggedMinutesLast7Days} min</strong>
                <p>Logged in the last seven days</p>
              </div>
            </div>
            <p>
              {data.completedTopics}/{data.totalTopics} topics · {data.projectsSubmitted}/
              {data.projectsRequired} projects submitted
            </p>
            {data.nextMilestone ? (
              <p>
                Next milestone: {data.nextMilestone.title} ({data.nextMilestone.remainingTopics}{' '}
                topics remaining).
              </p>
            ) : (
              data.totalTopics > 0 && <p>Your roadmap topics are complete.</p>
            )}
            {data.behindSchedule && (
              <p role="status">
                {data.overdueHours} estimated hours remain from past weeks.{' '}
                <Link to="/plan">Review and replan</Link>
              </p>
            )}
          </>
        ) : (
          <p>
            Add your skills, choose a goal, then <Link to="/roadmap">generate a roadmap</Link>.
          </p>
        )}
        <Link className="text-link" to="/progress">
          Log learning or submit a project
        </Link>
      </section>
      <section className="skills-card">
        <h2>This week</h2>
        {data.currentWeek ? (
          <>
            <p>
              {data.currentWeek.plannedHours} hours planned · {data.currentWeek.loggedMinutes}{' '}
              minutes logged across all goals this plan week
            </p>
            {data.currentWeek.tasks.length ? (
              <ul>
                {data.currentWeek.tasks.map((task) => (
                  <li className="progress-task" key={task.id}>
                    <span>
                      {task.title} · {task.allocatedHours} hours{task.isProject ? ' · Project' : ''}
                    </span>
                    <TaskControl id={task.id} title={task.title} status={task.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p>Buffer week: catch up or review.</p>
            )}
          </>
        ) : (
          <p>
            No tasks scheduled for this week. <Link to="/plan">Set or review your weekly plan</Link>
            .
          </p>
        )}
      </section>
      <Suspense fallback={<p role="status">Loading charts…</p>}>
        <Charts data={data} />
      </Suspense>
    </>
  );
}
