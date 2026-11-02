import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Clock3, ArrowRight, BookOpen } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { currentRoadmapSchema } from './roadmap.api';
import { TopicCompletion } from './TopicCompletion';
import { getSkillProgress, getAnalytics, studioKeys } from '@/features/studio/studio.api';
import { useStudioSettings } from '@/features/studio/useStudioSettings';
import '@/features/studio/studio.css';

type Current = z.infer<typeof currentRoadmapSchema>;
export function RoadmapJourney({ data }: { data: Current }) {
  const [focus, setFocus] = useState(false),
    [week, setWeek] = useState(false);
  const shared = useQuery({ queryKey: studioKeys.progress, queryFn: getSkillProgress });
  const preferences = useStudioSettings();
  const overview = useQuery({
    queryKey: studioKeys.overview,
    queryFn: () => getAnalytics(undefined, 7),
    enabled: preferences.ready,
  });
  const roadmap = data.roadmap!;
  const states = new Map(shared.data?.progress.map((row) => [row.skillId, row]));
  const topics = roadmap.phases.flatMap((phase) => phase.topics);
  const scheduledSkills = new Set(
    topics.flatMap((topic) => (topic.skillId ? [topic.skillId] : [])),
  );
  const startingStrengths = data.analysis.strengths.filter(
    (skill) => !scheduledSkills.has(skill.skillId),
  );
  const state = (topic: (typeof topics)[number]) => {
    const progress = topic.skillId ? states.get(topic.skillId) : undefined;
    if (
      progress?.status === 'SKIPPED' &&
      startingStrengths.some((row) => row.skillId === topic.skillId)
    )
      return 'Skipped';
    // The topic projects shared progress at this goal's required proficiency.
    if (topic.status === 'DONE') return 'Done';
    return topic.status === 'IN_PROGRESS' || progress?.status === 'IN_PROGRESS'
      ? 'In progress'
      : 'Later';
  };
  const finished = (topic: (typeof topics)[number]) => ['Done', 'Skipped'].includes(state(topic));
  const next = topics.find((topic) => !finished(topic));
  const currentStage = Math.max(
    0,
    roadmap.phases.findIndex((phase) => phase.topics.some((topic) => !finished(topic))),
  );
  const done = topics.filter(finished).length,
    percent = topics.length ? Math.round((done / topics.length) * 100) : 0;
  const hoursLeft = topics
    .filter((topic) => !finished(topic))
    .reduce((sum, topic) => sum + topic.estimatedHours, 0);
  const focusIds = new Set(
    topics
      .filter((topic) => !finished(topic))
      .slice(0, 3)
      .map((topic) => topic.id),
  );
  const learnLink = (topic: (typeof topics)[number]) => {
    if (topic.isProject) return '/progress';
    const linked = shared.data?.links.find(
      (link) => link.skillId === topic.skillId && link.done < link.total,
    );
    return linked
      ? `/studio/${linked.resourceId}/study${linked.itemId ? `?item=${linked.itemId}` : ''}`
      : `/studio${topic.skillId ? `?skill=${topic.skillId}` : ''}`;
  };
  return (
    <>
      <section className="skills-card journey-summary">
        <div
          className="career-match-ring"
          role="progressbar"
          aria-label="Roadmap completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          style={{
            background: `conic-gradient(var(--cloud-accent) ${percent}%, var(--cloud-border) 0)`,
          }}
        >
          <strong>{percent}%</strong>
        </div>
        <div>
          <p className="field-hint">Your journey · Version {roadmap.version}</p>
          <h2>{roadmap.title}</h2>
          <p>
            {done} of {topics.length} steps done · About {Math.ceil(hoursLeft)} hours left
          </p>
          <p>
            {topics.filter((topic) => !topic.isProject && finished(topic)).length +
              startingStrengths.length}
            /{topics.filter((topic) => !topic.isProject).length + startingStrengths.length} skills
            ready · {overview.data?.streak.current ?? 0} day learning streak
          </p>
        </div>
      </section>
      <section className="skills-card journey-next">
        <span className="journey-eyebrow">
          {next ? 'Your next step' : 'Look how far you’ve come'}
        </span>
        <h2>{next?.title ?? 'Your roadmap is complete'}</h2>
        <p>
          {next
            ? 'One focused session is a good start. Pick up here when you’re ready.'
            : 'Your skills and completed milestones are saved. Keep your projects close for your next opportunity.'}
        </p>
        {next && (
          <div className="learning-actions">
            <Button asChild>
              <Link to={learnLink(next)}>
                Continue learning <ArrowRight size={16} />
              </Link>
            </Button>
            <a className="text-link" href={`#topic-${next.id}`}>
              Review this step
            </a>
          </div>
        )}
      </section>
      <div className="journey-toolbar">
        <Button variant="outline" aria-pressed={focus} onClick={() => setFocus(!focus)}>
          {focus ? 'Show full roadmap' : 'Show only my next 3 skills'}
        </Button>
        <Button variant="outline" aria-expanded={week} onClick={() => setWeek(!week)}>
          My weekly plan
        </Button>
      </div>
      {week && (
        <section className="skills-card">
          <h2>A little progress this week</h2>
          <p>
            Choose a pace that fits your week. Your existing plan and completed work stay saved.
          </p>
          <Button asChild variant="outline">
            <Link to="/plan">Open weekly plan</Link>
          </Button>
        </section>
      )}
      <section className="journey-path" aria-label="Roadmap stages">
        {roadmap.phases.map((phase, index) => {
          const complete = phase.topics.filter(finished).length;
          const stagePercent = phase.topics.length
            ? Math.round((complete / phase.topics.length) * 100)
            : 0;
          const project = phase.topics.find((topic) => topic.isProject);
          const visible = focus
            ? phase.topics.filter((topic) => focusIds.has(topic.id))
            : phase.topics;
          if (focus && !visible.length) return null;
          return (
            <details
              className={`skills-card journey-stage ${index === currentStage ? 'current' : ''} ${stagePercent === 100 ? 'complete' : ''}`}
              key={phase.id}
              open={focus || index === currentStage}
            >
              <summary>
                <span className="journey-stage-number">
                  {stagePercent === 100 ? <CheckCircle2 aria-label="Stage complete" /> : index + 1}
                </span>
                <span>
                  <strong>{phase.title}</strong>
                  <small>
                    {index === currentStage && stagePercent < 100 ? 'Your current stage · ' : ''}
                    {complete}/{phase.topics.length} steps done
                  </small>
                </span>
                <span className="journey-stage-percent">{stagePercent}%</span>
              </summary>
              <p>{phase.description.split('. ')[0]}.</p>
              {project && (
                <p className="journey-project">
                  <BookOpen size={16} aria-hidden="true" /> Milestone: {project.title}
                </p>
              )}
              <ul className="journey-skills">
                {visible.map((topic) => {
                  const label = finished(topic)
                    ? state(topic)
                    : next?.id === topic.id
                      ? 'Up next'
                      : state(topic);
                  const links =
                    shared.data?.links.filter((link) => link.skillId === topic.skillId) ?? [];
                  return (
                    <li
                      id={`topic-${topic.id}`}
                      key={topic.id}
                      className={`journey-skill ${finished(topic) ? 'done' : ''}`}
                    >
                      <div className="journey-skill-heading">
                        {finished(topic) ? (
                          <CheckCircle2 aria-hidden="true" />
                        ) : (
                          <Circle aria-hidden="true" />
                        )}
                        <div>
                          <h3>{topic.title}</h3>
                          <p>
                            {topic.isProject
                              ? 'Put what you learned into a project you can share.'
                              : (topic.subtopics[0] ??
                                'Build a practical foundation for your goal.')}
                          </p>
                        </div>
                      </div>
                      <div className="journey-skill-meta">
                        <span className="journey-status">{label}</span>
                        <span>
                          <Clock3 size={13} aria-hidden="true" /> {topic.estimatedHours}h
                        </span>
                        {links.map((link) => (
                          <Link
                            key={`${link.resourceId}-${link.sectionTitle}`}
                            to={`/studio/${link.resourceId}/study`}
                          >
                            Playlist: {link.done}/{link.total} videos
                          </Link>
                        ))}
                      </div>
                      <div className="learning-actions">
                        <Button asChild variant="outline">
                          <Link to={learnLink(topic)}>
                            {links.length ? 'Continue learning' : 'Learn this'}
                          </Link>
                        </Button>
                        <TopicCompletion
                          id={topic.id}
                          title={topic.title}
                          status={topic.status}
                          project={topic.isProject}
                        />
                      </div>
                      <details className="journey-details">
                        <summary>Details</summary>
                        <p>{topic.subtopics.join(' · ')}</p>
                        <p>
                          {topic.difficulty.toLowerCase()} practice · Keep your notes and examples
                          in Learning Studio.
                        </p>
                        {topic.resources.map((resource) => (
                          <p key={resource.url}>
                            <a
                              className="text-link"
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {resource.title}
                            </a>
                          </p>
                        ))}
                      </details>
                    </li>
                  );
                })}
              </ul>
              {visible.find((topic) => !finished(topic)) && (
                <Button asChild variant="outline">
                  <Link to={learnLink(visible.find((topic) => !finished(topic))!)}>
                    Start this stage
                  </Link>
                </Button>
              )}
            </details>
          );
        })}
      </section>
      {!!startingStrengths.length && (
        <details className="skills-card">
          <summary>Already in your toolkit · {startingStrengths.length} skipped skills</summary>
          <p>These starting skills meet this goal’s requirements and are not scheduled again.</p>
          <div className="goal-filters">
            {startingStrengths.map((skill) => (
              <span key={skill.skillId} className="journey-status">
                ✓ {skill.name} · Skipped
              </span>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
