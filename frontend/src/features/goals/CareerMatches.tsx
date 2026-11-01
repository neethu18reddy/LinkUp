import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCareerMatches, type CareerMatch } from './career.api';
import { requestError } from '@/lib/http';
import { Button } from '@/components/ui/button';

export function MatchList({ roles }: { roles: CareerMatch[] }) {
  return (
    <ol className="recommendation-list">
      {roles.map((role) => (
        <li key={role.roleId}>
          <h3>
            <Link to={`/roles/${role.slug}`}>{role.title}</Link>
          </h3>
          <strong>{role.matchPercent}% skill match</strong>
          <p>{role.explanation}</p>
          <p className="field-hint">
            Missing core skills:{' '}
            {role.missingCoreSkills.join(', ') || 'None — develop portfolio evidence.'}
          </p>
          <Link className="text-link" to={`/roles/${role.slug}`}>
            Review role and roadmap
          </Link>
        </li>
      ))}
    </ol>
  );
}
export function CareerMatches() {
  const query = useQuery({
    queryKey: ['career-matches'],
    queryFn: () => getCareerMatches(),
    staleTime: 0,
  });
  return (
    <section className="skills-card" aria-labelledby="matches-title">
      <h2 id="matches-title">Three directions from your skills</h2>
      {query.isPending ? (
        <p role="status">Comparing your skills…</p>
      ) : query.isError ? (
        <>
          <p role="alert">{requestError(query.error)}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry suggestions
          </Button>
        </>
      ) : (
        <>
          <p className="field-hint">
            These are learning directions, not a guarantee of employment. With no saved skills,
            explore a beginner starting point.
          </p>
          <MatchList roles={query.data.recommendations} />
          <details>
            <summary>Next five alternatives</summary>
            <MatchList roles={query.data.alternatives} />
          </details>
          {query.data.stretchRoles.length > 0 && (
            <details>
              <summary>Stretch directions</summary>
              <MatchList roles={query.data.stretchRoles} />
            </details>
          )}
        </>
      )}
    </section>
  );
}
