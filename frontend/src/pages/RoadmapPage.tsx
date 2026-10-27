import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { LearningSteps } from '@/components/layout/LearningSteps';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { generateRoadmap, getCurrentRoadmap, roadmapKey } from '@/features/roadmap/roadmap.api';

export function RoadmapPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: roadmapKey,
    queryFn: getCurrentRoadmap,
    retry: false,
    staleTime: 0,
  });
  const [review, setReview] = useState(false);
  const generation = useMutation({
    mutationFn: generateRoadmap,
    onSuccess: async () => {
      setReview(false);
      await client.invalidateQueries({ queryKey: roadmapKey });
      await client.invalidateQueries({ queryKey: ['progress-summary'] });
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.data?.error?.code === 'GOAL_CHANGED') {
        setReview(false);
        void client.invalidateQueries({ queryKey: roadmapKey });
      }
    },
  });
  const data = query.data;
  const needsGoal =
    axios.isAxiosError(query.error) && query.error.response?.data?.error?.code === 'GOAL_REQUIRED';
  const { hash } = useLocation();
  useEffect(() => {
    if (hash.startsWith('#topic-'))
      document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' });
  }, [hash, data]);
  return (
    <AccountLayout>
      <main className="skills-page">
        <LearningSteps />
        <p className="eyebrow">Your learning path</p>
        <h1>Roadmap</h1>
        <p className="auth-description">
          A clear path from where you are to where you want to be. Learn one step at a time.
        </p>
        {query.isPending ? (
          <p role="status">Comparing your skills with your goal…</p>
        ) : query.isError ? (
          <section className="skills-card roadmap-empty">
            <h2>Start with your direction</h2>
            {needsGoal ? (
              <p>
                Choose a career path or add your own goal. We’ll turn it into a roadmap you can
                follow.
              </p>
            ) : (
              <>
                <p role="alert">{requestError(query.error)}</p>
                <Button onClick={() => void query.refetch()}>Retry</Button>{' '}
              </>
            )}
            <Button asChild variant={needsGoal ? 'default' : 'outline'}>
              <Link to="/goals">Review your goal</Link>
            </Button>
          </section>
        ) : (
          data && (
            <>
              <section className="skills-card">
                <h2>Where to focus</h2>
                {data.roadmap?.generationSource === 'template-custom' && (
                  <p className="custom-roadmap-notice">
                    Your custom goal uses a general starter roadmap. Choose learning materials for
                    your subject and use these milestones to guide your practice.
                  </p>
                )}
                {data.analysis.gaps.length ? (
                  <ol>
                    {data.analysis.gaps.map((gap) => (
                      <li key={gap.skillId}>
                        <strong>{gap.name}</strong> —{' '}
                        {gap.currentLevel?.toLowerCase() ?? 'not added'} →{' '}
                        {gap.requiredLevel.toLowerCase()} (priority {gap.score})
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>
                    {data.analysis.strengths.length
                      ? 'Your listed skills meet this goal’s requirements. Use the roadmap for review and practice.'
                      : 'Your custom goal starts with exploration, guided practice and a project. No catalogue skill assessment is available for this goal.'}
                  </p>
                )}
                {!!data.analysis.strengths.length && (
                  <p>
                    Strong areas: {data.analysis.strengths.map((skill) => skill.name).join(', ')}.
                  </p>
                )}
                <p className="field-hint">
                  {data.provider === 'template'
                    ? 'Offline templates are active.'
                    : 'AI generation is enabled.'}{' '}
                  Three attempts per UTC day. Estimates are a starting point.
                </p>
                {review ? (
                  <div>
                    <p>
                      {data.roadmap
                        ? 'Create a new version? Your previous roadmap and progress will be kept.'
                        : 'Generate a roadmap from your saved goal and current skill profile?'}
                    </p>
                    <Button
                      disabled={generation.isPending}
                      onClick={() => generation.mutate(data.goalId)}
                    >
                      Confirm generation
                    </Button>{' '}
                    <Button
                      variant="outline"
                      disabled={generation.isPending}
                      onClick={() => setReview(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => setReview(true)}>
                    {data.roadmap ? 'Create new version' : 'Generate roadmap'}
                  </Button>
                )}
                {generation.isPending && (
                  <p role="status">
                    Building and validating your roadmap, then saving it… This can take a minute.
                  </p>
                )}
                {generation.isError && <p role="alert">{requestError(generation.error)}</p>}
                {generation.data?.notice && <p role="status">{generation.data.notice}</p>}
              </section>
              {data.roadmap ? (
                <section className="skills-card">
                  <h2>{data.roadmap.title}</h2>
                  <div className="learning-metrics">
                    <div>
                      <span>Learning time</span>
                      <strong>
                        {data.roadmap.totalEstimatedHours}
                        <small> hours</small>
                      </strong>
                    </div>
                    <div>
                      <span>Your journey</span>
                      <strong>
                        {data.roadmap.phases.length}
                        <small> phases</small>
                      </strong>
                    </div>
                    <div>
                      <span>Milestones</span>
                      <strong>
                        {data.roadmap.phases.reduce((sum, phase) => sum + phase.topics.length, 0)}
                        <small> topics</small>
                      </strong>
                    </div>
                  </div>
                  <p>
                    Version {data.roadmap.version} · {data.roadmap.totalEstimatedHours} estimated
                    hours ·{' '}
                    {data.roadmap.generationSource.startsWith('template')
                      ? 'Curated template'
                      : 'AI generated'}
                  </p>
                  <Button asChild variant="outline">
                    <Link to="/plan">Set your weekly plan</Link>
                  </Button>
                  {data.roadmap.phases.map((phase) => (
                    <details className="roadmap-phase" key={phase.id} open>
                      <summary>
                        {phase.title} ·{' '}
                        {phase.topics.filter((topic) => topic.status === 'DONE').length}/
                        {phase.topics.length} topics completed
                      </summary>
                      <p>{phase.description}</p>
                      <ol>
                        {phase.topics.map((topic) => (
                          <li key={topic.id} id={`topic-${topic.id}`}>
                            <strong>{topic.title}</strong>
                            {topic.isProject ? ' · Project' : ''} · {topic.estimatedHours} hours
                            <span className="topic-status">
                              {' '}
                              · {topic.status?.replaceAll('_', ' ').toLowerCase() ?? 'todo'} ·{' '}
                              {topic.difficulty.toLowerCase()}
                            </span>
                            <p>{topic.subtopics.join(' · ')}</p>
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
                          </li>
                        ))}
                      </ol>
                    </details>
                  ))}
                </section>
              ) : (
                <p>No roadmap yet. Review your gaps and generate your first version.</p>
              )}
            </>
          )
        )}
      </main>
    </AccountLayout>
  );
}
