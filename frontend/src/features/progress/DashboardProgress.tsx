import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { getProgress, progressKey } from './progress.api';
import { TaskControl } from './TaskControl';
import { ArrowUpRight, BookOpen, Clock3, Flame, Plus, Sparkles } from 'lucide-react';
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
      <section className="skills-card learning-overview">
        <div className="overview-heading">
          <div>
            <span className="section-kicker">YOUR MOMENTUM</span>
            <h2>{data.roadmap?.title ?? 'Your next step'}</h2>
          </div>
          <Button variant="glow" asChild>
            <Link to="/progress">
              <Plus size={17} aria-hidden="true" />
              Log learning
            </Link>
          </Button>
        </div>
        {data.roadmap ? (
          <>
            <div className="progress-metrics">
              <div className="metric-card metric-completion">
                <div
                  className="progress-ring shadow-lg shadow-emerald-900/10"
                  role="progressbar"
                  aria-label="Overall progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={data.overallPercent}
                  style={{
                    background: `conic-gradient(#10b981 ${data.overallPercent}%, #e0e6e1 0)`,
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
                  <Flame size={21} className="text-amber-500 animate-pulse" aria-hidden="true" />
                </span>
                <strong>
                  {data.streak} {data.streak === 1 ? 'day' : 'days'}
                </strong>
                <p>Learning streak (UTC)</p>
                <div className="streak-dots my-2 flex gap-1.5 justify-center" aria-hidden="true">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <span
                      key={i}
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                        i < Math.min(data.streak, 7)
                          ? 'bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                          : 'bg-emerald-950/10 text-emerald-950/50'
                      }`}
                    >
                      {day}
                    </span>
                  ))}
                </div>
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
                <Link to="/plan">Review and replan</Link>
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
