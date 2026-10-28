import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { getProgress, progressKey } from './progress.api';
import { TaskControl } from './TaskControl';
import { LoadingState } from '@/components/ui/loading-state';
import { ArrowUpRight, BookOpen, Clock3, Flame, Plus, Sparkles } from 'lucide-react';
const Charts = lazy(() =>
  import('./ProgressCharts').then((module) => ({ default: module.ProgressCharts })),
);
export function DashboardProgress() {
  const query = useQuery({ queryKey: progressKey, queryFn: getProgress });
  if (query.isPending) return <LoadingState label="Loading your progress…" />;
  if (query.isError)
    return (
      <section className="skills-card">
        <p role="alert">{requestError(query.error)}</p>
        <Button onClick={() => void query.refetch()}>Retry progress</Button>
      </section>
    );
  const data = query.data;
  const nextTask = data.currentWeek?.tasks.find((task) => task.status !== 'DONE');
  return (
    <>
      <section className="skills-card learning-overview">
        <div className="overview-heading">
          <div>
            <h2>{data.roadmap?.title ?? 'Your next step'}</h2>
          </div>
          <Button variant="glow" asChild>
            <Link to="/progress">
              <Plus size={17} aria-hidden="true" />
              Log learning
            </Link>
          </Button>
        </div>
        {nextTask && (
          <div className="next-learning-action">
            <div>
              <span>Up next in your week</span>
              <h3>{nextTask.title}</h3>
              <p>{nextTask.allocatedHours} planned hours · Pick up where you left off.</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/plan">
                Continue my plan <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>
        )}
        {data.roadmap ? (
          <>
            <div className="progress-metrics">
              <div className="metric-card metric-completion">
                <div
                  className="progress-ring"
                  role="progressbar"
                  aria-label="Overall progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={data.overallPercent}
                  style={{
                    background: `conic-gradient(#225c47 ${data.overallPercent}%, #e0e6e1 0)`,
                  }}
                >
                  <strong>{data.overallPercent}%</strong>
                </div>
                <p>Overall progress</p>
                <p>
                  {data.completedHours} of {data.totalHours} estimated hours completed
                </p>
              </div>
              <div className="metric-card metric-streak">
                <span className="metric-icon">
                  <Flame size={21} aria-hidden="true" />
                </span>
                <strong>
                  {data.streak} {data.streak === 1 ? 'day' : 'days'}
                </strong>
                <p>Learning streak (UTC)</p>
                <small>Keep showing up, one day at a time.</small>
              </div>
              <div className="metric-card metric-time">
                <span className="metric-icon">
                  <Clock3 size={21} aria-hidden="true" />
                </span>
                <strong>{data.loggedMinutesLast7Days} min</strong>
                <p>Logged in the last seven days</p>
                <small>Every focused minute counts.</small>
              </div>
            </div>
            <p className="completion-summary">
              <BookOpen size={17} aria-hidden="true" />
              {data.completedTopics}/{data.totalTopics} topics · {data.projectsSubmitted}/
              {data.projectsRequired} projects submitted
            </p>
            {data.nextMilestone ? (
              <p className="milestone-callout">
                <Sparkles size={18} aria-hidden="true" />
                Next milestone: {data.nextMilestone.title} ({data.nextMilestone.remainingTopics}{' '}
                topics remaining).
              </p>
            ) : (
              data.totalTopics > 0 && <p>Your roadmap topics are complete.</p>
            )}
            {data.behindSchedule && (
              <p role="status">
                {data.overdueHours} estimated hours remain from past weeks.{' '}
                <Link className="text-link" to="/plan">
                  Review and replan
                </Link>
              </p>
            )}
          </>
        ) : (
          <p>
            Add your skills, choose a goal, then <Link to="/roadmap">generate a roadmap</Link>.
          </p>
        )}
        <div className="learning-actions">
          <Button variant="outline" asChild>
            <Link to="/plan">
              Open weekly plan <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/progress">
              Submit a project <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
      <section className="skills-card weekly-overview">
        <h2>This week</h2>
        {data.currentWeek ? (
          <>
            <p>
              {data.currentWeek.plannedHours} hours planned · {data.currentWeek.loggedMinutes}{' '}
              minutes logged across all goals this plan week
            </p>
            {data.currentWeek.tasks.length ? (
              <ul className="weekly-task-list">
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
