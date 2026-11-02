import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { LearningSteps } from '@/components/layout/LearningSteps';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { generateRoadmap, getCurrentRoadmap, roadmapKey } from '@/features/roadmap/roadmap.api';
import { PageHeader } from '@/components/layout/PageHeader';
import { RoadmapJourney } from '@/features/roadmap/RoadmapJourney';

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
        <PageHeader
          eyebrow="Your learning path"
          title="Roadmap"
          description="A clear path from where you are to where you want to be. Learn one step at a time."
        />
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
              <details className="skills-card" open={!data.roadmap}>
                <summary>
                  {data.roadmap
                    ? 'Review starting skills or create a new version'
                    : 'Build your first roadmap'}
                </summary>
                {data.roadmap?.generationSource === 'template-custom' && (
                  <p className="custom-roadmap-notice">
                    Your custom goal uses a general starter roadmap. Choose learning materials for
                    your subject and use these milestones to guide your practice.
                  </p>
                )}
                {data.analysis.gaps.length ? (
                  <ol>
                    {data.analysis.gaps.map((gap) => (
                      <li
                        key={gap.skillId}
                        className={`career-gap ${gap.currentLevel ? 'partial' : 'missing'}`}
                      >
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
                    Completed starting skills:{' '}
                    {data.analysis.strengths.map((skill) => skill.name).join(', ')}.
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
              </details>
              {data.roadmap ? (
                <RoadmapJourney data={data} />
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
