import { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountLayout } from '@/components/layout/AccountLayout';
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
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.data?.error?.code === 'GOAL_CHANGED') {
        setReview(false);
        void client.invalidateQueries({ queryKey: roadmapKey });
      }
    },
  });
  const data = query.data;
  return (
    <AccountLayout>
      <main className="skills-page">
        <p className="eyebrow">Your learning path</p>
        <h1>Roadmap</h1>
        {query.isPending ? (
          <p role="status">Comparing your skills with your goal…</p>
        ) : query.isError ? (
          <section className="skills-card">
            <p role="alert">{requestError(query.error)}</p>
            <Button onClick={() => void query.refetch()}>Retry</Button>{' '}
            <Link to="/goals">Review your goal</Link>
          </section>
        ) : (
          data && (
            <>
              <section className="skills-card">
                <h2>Where to focus</h2>
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
                    Your listed skills meet this goal’s requirements. Use the roadmap for review and
                    practice.
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
                  <p>
                    Version {data.roadmap.version} · {data.roadmap.totalEstimatedHours} estimated
                    hours ·{' '}
                    {data.roadmap.generationSource.startsWith('template')
                      ? 'Curated template'
                      : 'AI generated'}
                  </p>
                  {data.roadmap.phases.map((phase) => (
                    <article key={phase.id}>
                      <h3>{phase.title}</h3>
                      <p>{phase.description}</p>
                      <ol>
                        {phase.topics.map((topic) => (
                          <li key={topic.id}>
                            <strong>{topic.title}</strong>
                            {topic.isProject ? ' · Project' : ''} · {topic.estimatedHours} hours
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
                    </article>
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
