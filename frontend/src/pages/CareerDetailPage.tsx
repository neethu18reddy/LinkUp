import { useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { getCareer } from '@/features/goals/career.api';
import { getCurrentGoal, saveGoal, goalKeys } from '@/features/goals/goals.api';
import { getProfileSkills, skillKeys } from '@/features/skills/skills.api';
import { requestError } from '@/lib/http';

const levels = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
};
export function CareerDetailPage() {
  const { slug = '' } = useParams(),
    navigate = useNavigate(),
    client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const query = useQuery({ queryKey: ['career-detail', slug], queryFn: () => getCareer(slug) });
  const profile = useQuery({ queryKey: skillKeys.profile, queryFn: getProfileSkills });
  const current = useQuery({ queryKey: goalKeys.current, queryFn: getCurrentGoal });
  const save = useMutation({
    mutationFn: saveGoal,
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.data?.error?.code === 'GOAL_CHANGED')
        void client.invalidateQueries({ queryKey: goalKeys.current });
    },
    onSuccess: (goal) => {
      client.setQueryData(goalKeys.current, goal);
      void client.invalidateQueries({ queryKey: ['current-roadmap'] });
      void client.invalidateQueries({ queryKey: ['progress-summary'] });
      void navigate('/roadmap');
    },
  });
  const data = query.data;
  const known = new Map(profile.data?.map((skill) => [skill.skillId, levels[skill.level]]));
  const canonicalKnown = new Set(
    profile.data?.map((entry) =>
      entry.skill.name
        .toLowerCase()
        .replace(/\+/g, 'plus')
        .replace(/#/g, 'sharp')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    ),
  );
  const importance: Record<string, number> = { core: 3, important: 2, 'nice-to-have': 1 };
  const total =
    data?.role.skills.reduce(
      (sum, row) => sum + row.weight * (importance[row.importance] ?? 1),
      0,
    ) ?? 0;
  const earned =
    data?.role.skills.reduce(
      (sum, row) =>
        sum +
        row.weight *
          (importance[row.importance] ?? 1) *
          Math.min(
            1,
            known.has(row.skill.databaseId)
              ? (known.get(row.skill.databaseId) ?? 0) /
                  (levels[row.requiredLevel as keyof typeof levels] ?? 1)
              : row.skill.related.some((id) => canonicalKnown.has(id))
                ? 0.15
                : 0,
          ),
      0,
    ) ?? 0;
  const percent = total ? Math.round((earned / total) * 100) : 0;
  return (
    <AccountLayout>
      <main className="dashboard-main">
        <Link className="text-link" to="/roles">
          ← All career paths
        </Link>
        {query.isPending ? (
          <p role="status">Loading role and roadmap…</p>
        ) : query.isError ? (
          <>
            <p role="alert">{requestError(query.error)}</p>
            <Button onClick={() => void query.refetch()}>Retry role</Button>
          </>
        ) : (
          data && (
            <>
              <PageHeader
                eyebrow={data.role.category.replaceAll('-', ' ').toUpperCase()}
                title={data.role.name}
                description={data.role.description}
              />
              <section className="skills-card">
                <h2>Your starting point</h2>
                <p>
                  Experience: {data.role.experienceBand} · Demand signal: {data.role.demand}
                  {data.role.trending ? ' · Trending' : ''}
                </p>
                <p className="field-hint">
                  Demand labels are editorial exploration signals. Job availability and professional
                  qualification requirements vary by location.
                </p>
                {profile.isPending ? (
                  <p role="status">Comparing skills…</p>
                ) : profile.isError ? (
                  <>
                    <p role="alert">{requestError(profile.error)}</p>
                    <Button onClick={() => void profile.refetch()}>Retry skills</Button>
                  </>
                ) : (
                  <>
                    <div
                      className="career-match-ring"
                      role="progressbar"
                      aria-label="Role skill match"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      style={{ background: `conic-gradient(#6750a4 ${percent}%, #e8e2f2 0)` }}
                    >
                      <strong>{percent}%</strong>
                    </div>
                    <p>Green: meets level · Amber: partial · Red: missing</p>
                  </>
                )}
                {['core', 'important', 'nice-to-have'].map((group) => (
                  <div key={group}>
                    <h3>{group.replaceAll('-', ' ')} skills</h3>
                    <ul className="career-skill-grid">
                      {data.role.skills
                        .filter((row) => row.importance === group)
                        .map((row) => {
                          const level = known.get(row.skill.databaseId) ?? 0,
                            adjacent = row.skill.related.some((id) => canonicalKnown.has(id)),
                            target = levels[row.requiredLevel as keyof typeof levels] ?? 1;
                          return (
                            <li
                              key={row.skillId}
                              className={`career-gap ${level >= target ? 'known' : level || adjacent ? 'partial' : 'missing'}`}
                            >
                              <strong>{row.skill.name}</strong>
                              <span>
                                {profile.isSuccess
                                  ? level >= target
                                    ? 'Completed — meets level'
                                    : level
                                      ? 'Partial — build proficiency'
                                      : adjacent
                                        ? 'Adjacent starting point'
                                        : 'Missing'
                                  : 'Comparison unavailable'}{' '}
                                · target {row.requiredLevel}
                              </span>
                              <p>{row.skill.description}</p>
                              <details>
                                <summary>Learning resources</summary>
                                {row.skill.resources.map((resource) => (
                                  <p key={resource.url}>
                                    <a
                                      className="text-link"
                                      href={resource.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {resource.title}
                                    </a>{' '}
                                    ·{' '}
                                    {resource.free
                                      ? 'Free learning material'
                                      : 'May include paid material'}
                                  </p>
                                ))}
                              </details>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ))}
                <p>
                  Beginner: about {data.roadmap.durationWeeks.beginner} weeks · Intermediate:{' '}
                  {data.roadmap.durationWeeks.intermediate} · Advanced:{' '}
                  {data.roadmap.durationWeeks.advanced}, at 10 hours/week before personalizing gaps.
                </p>
                {current.isError ? (
                  <>
                    <p role="alert">{requestError(current.error)}</p>
                    <Button variant="outline" onClick={() => void current.refetch()}>
                      Retry saved goal
                    </Button>
                  </>
                ) : confirming ? (
                  <div className="goal-review">
                    <p>
                      Set {data.role.name} as your target?
                      {current.data &&
                        ` Your current goal, ${current.data.targetRole}, and its work will stay saved.`}
                    </p>
                    <div className="goal-actions">
                      <Button
                        variant="outline"
                        disabled={save.isPending}
                        onClick={() => setConfirming(false)}
                      >
                        Keep exploring
                      </Button>
                      <Button
                        disabled={save.isPending || !current.isSuccess || current.isFetching}
                        onClick={() =>
                          save.mutate({
                            kind: 'ROLE',
                            roleId: data.role.databaseId,
                            expectedGoalId: current.data?.id ?? null,
                          })
                        }
                      >
                        {save.isPending ? 'Saving…' : 'Confirm and start roadmap'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button disabled={current.isPending} onClick={() => setConfirming(true)}>
                    Start roadmap
                  </Button>
                )}
                {save.error && <p role="alert">{requestError(save.error)}</p>}
              </section>
              <section className="skills-card career-timeline">
                <h2>Your roadmap preview</h2>
                {data.roadmap.stages.map((stage) => (
                  <article className="roadmap-phase" key={stage.order}>
                    <h3>
                      {stage.order}. {stage.title}
                    </h3>
                    <p>{stage.goal}</p>
                    <p>
                      <strong>Milestone project:</strong> {stage.milestoneProject}
                    </p>
                    <p>
                      <strong>Checkpoint:</strong> {stage.checkpoint}
                    </p>
                    <p>{stage.estimatedWeeks} estimated weeks</p>
                  </article>
                ))}
                <h3>Interview preparation</h3>
                <p>{data.roadmap.interviewTopics.join(' · ')}</p>
                <h3>Resume keywords</h3>
                <p>{data.roadmap.resumeKeywords.join(' · ')}</p>
              </section>
              <section className="skills-card">
                <h2>Related directions</h2>
                <ul>
                  {data.relatedRoles.map((role) => (
                    <li key={role.id}>
                      <Link className="text-link" to={`/roles/${role.id}`}>
                        {role.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                {(['from', 'to'] as const).map((direction) => (
                  <div key={direction}>
                    <h3>
                      {direction === 'from' ? 'Possible starting roles' : 'Possible next roles'}
                    </h3>
                    {data.careerPath[direction].length ? (
                      data.careerPath[direction].map((role) => (
                        <p key={role.id}>
                          <Link className="text-link" to={`/roles/${role.id}`}>
                            {role.name}
                          </Link>
                        </p>
                      ))
                    ) : (
                      <p>Career transitions depend on your experience and portfolio.</p>
                    )}
                  </div>
                ))}
              </section>
            </>
          )
        )}
      </main>
    </AccountLayout>
  );
}
