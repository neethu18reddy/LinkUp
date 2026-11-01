import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { getCareers, getCareerCategories } from '@/features/goals/career.api';
import { CareerQuestionnaire } from '@/features/goals/CareerQuestionnaire';
import { CareerMatches } from '@/features/goals/CareerMatches';
import { requestError } from '@/lib/http';

export function CareersPage() {
  const [search, setSearch] = useState(''),
    [category, setCategory] = useState(''),
    [sort, setSort] = useState('trending'),
    [page, setPage] = useState(1),
    [guided, setGuided] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const categories = useQuery({
    queryKey: ['career-categories'],
    queryFn: getCareerCategories,
    staleTime: Infinity,
  });
  const query = useQuery({
    queryKey: ['career-list', deferredSearch, category, sort, page],
    queryFn: () => getCareers({ search: deferredSearch, category, sort, page }),
  });
  return (
    <AccountLayout>
      <main className="dashboard-main goals-page">
        <PageHeader
          eyebrow="YOUR NEXT DIRECTION"
          title="Explore career paths"
          description="Build on what you know, or discover a new starting point."
        />
        <div className="goal-actions">
          <Button onClick={() => setGuided(!guided)} aria-expanded={guided}>
            {guided ? 'Close guided path' : 'Find my direction'}
          </Button>
          <Button asChild variant="outline">
            <Link to="/skills">Choose my skills</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/goals">My saved goal</Link>
          </Button>
        </div>
        {guided && <CareerQuestionnaire />}
        <section className="skills-card">
          <h2>Browse roles</h2>
          <div className="career-search-controls">
            <div className="form-field">
              <label htmlFor="career-search">Search roles and skills</label>
              <input
                id="career-search"
                type="search"
                maxLength={100}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Try AI, finance, design or Python"
              />
            </div>
            <div className="form-field">
              <label htmlFor="career-sort">Sort roles</label>
              <select
                id="career-sort"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                <option value="trending">Trending first</option>
                <option value="name">A–Z</option>
                <option value="skills">Most skills</option>
              </select>
            </div>
          </div>
          <div className="goal-filters" aria-label="Career categories">
            <button
              type="button"
              aria-pressed={!category}
              onClick={() => {
                setCategory('');
                setPage(1);
              }}
            >
              All
            </button>
            {categories.data?.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={category === item.id}
                onClick={() => {
                  setCategory(item.id);
                  setPage(1);
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
          {categories.isError && (
            <p role="alert">
              Category filters could not load.{' '}
              <button type="button" className="text-link" onClick={() => void categories.refetch()}>
                Retry categories
              </button>
            </p>
          )}
          {query.isPending ? (
            <p role="status">Loading career paths…</p>
          ) : query.isError ? (
            <>
              <p role="alert">{requestError(query.error)}</p>
              <Button onClick={() => void query.refetch()}>Retry roles</Button>
            </>
          ) : (
            <>
              <p role="status">
                {query.data.total} {query.data.total === 1 ? 'career path' : 'career paths'} · page{' '}
                {page} of {Math.max(1, query.data.pages)}
              </p>
              <div className="goal-grid">
                {query.data.roles.map((role) => (
                  <Link className="goal-option" key={role.id} to={`/roles/${role.slug}`}>
                    <span className="goal-option-top">
                      <span className="goal-category">
                        {categories.data?.find((item) => item.id === role.category)?.name ??
                          role.category}
                      </span>
                      {role.trending && <span className="career-trending">Trending</span>}
                    </span>
                    <strong>{role.title}</strong>
                    <span className="goal-option-description">{role.description}</span>
                    <span className="goal-skill-count">
                      {role.coreSkills} core skills · Guided roadmap
                    </span>
                  </Link>
                ))}
              </div>
              {!query.data.roles.length && (
                <p>No matching roles. Try a different search or category.</p>
              )}
              <nav className="goal-actions" aria-label="Career result pages">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous page
                </Button>
                <Button
                  variant="outline"
                  disabled={page >= query.data.pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next page
                </Button>
              </nav>
            </>
          )}
        </section>
        <CareerMatches />
      </main>
    </AccountLayout>
  );
}
