import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCareerCategories, searchCareerSkills } from '@/features/goals/career.api';
import {
  addProfileSkill,
  getProfileSkills,
  levelLabels,
  skillKeys,
  type SkillLevel,
  addCustomSkill,
} from './skills.api';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';

export function SkillExplorer() {
  const client = useQueryClient(),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState(''),
    [selected, setSelected] = useState<Record<string, string>>({}),
    [level, setLevel] = useState<SkillLevel>('BEGINNER');
  const deferred = useDeferredValue(search);
  const categories = useQuery({
    queryKey: ['career-categories'],
    queryFn: getCareerCategories,
    staleTime: Infinity,
  });
  const profile = useQuery({ queryKey: skillKeys.profile, queryFn: getProfileSkills });
  const query = useQuery({
    queryKey: ['explore-skills', deferred, category],
    queryFn: () => searchCareerSkills(deferred, category),
  });
  const save = useMutation({
    mutationFn: async () => {
      // Sequential saves expose exactly which selections remain if a request fails.
      for (const [id] of Object.entries(selected)) {
        await addProfileSkill({ skillId: id, level });
        setSelected((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
      }
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: skillKeys.profile });
      void client.invalidateQueries({ queryKey: ['career-matches'] });
    },
  });
  const custom = useMutation({
    mutationFn: () => addCustomSkill(search.trim(), level),
    onSuccess: () => {
      setSearch('');
      void client.invalidateQueries({ queryKey: skillKeys.profile });
      void client.invalidateQueries({ queryKey: ['career-matches'] });
    },
  });
  const count = Object.keys(selected).length;
  const available =
    query.data?.filter((skill) => !profile.data?.some((row) => row.skillId === skill.id)) ?? [];
  return (
    <section className="skills-card">
      <h2>Browse the skill catalog</h2>
      <p>
        Search by name, alias or close spelling. Select several skills, choose your level and save
        them together.
      </p>
      <div className="career-search-controls">
        <div className="form-field">
          <label htmlFor="explore-skill-search">Find skills</label>
          <input
            id="explore-skill-search"
            type="search"
            maxLength={100}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              custom.reset();
            }}
            placeholder="Try reactjs, financial modeling or Blender"
          />
        </div>
        <div className="form-field">
          <label htmlFor="explore-skill-category">Skill domain</label>
          <select
            id="explore-skill-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All domains</option>
            {categories.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="goal-filters" aria-label="Popular skill shortcuts">
        {['Python', 'React', 'SQL', 'Figma', 'Excel', 'Financial Modeling'].map((name) => (
          <button type="button" key={name} onClick={() => setSearch(name)}>
            {name}
          </button>
        ))}
      </div>
      <div className="selected-skill-chips" aria-label="Selected skills">
        {Object.entries(selected).map(([id, name]) => (
          <button
            type="button"
            key={id}
            disabled={save.isPending}
            onClick={() =>
              setSelected((current) => {
                const next = { ...current };
                delete next[id];
                return next;
              })
            }
          >
            {name} <span aria-label="Remove selection">×</span>
          </button>
        ))}
      </div>
      {count > 0 && (
        <div className="goal-actions">
          <label htmlFor="batch-skill-level">Level for selected skills</label>
          <select
            id="batch-skill-level"
            value={level}
            disabled={save.isPending}
            onChange={(event) => setLevel(event.target.value as SkillLevel)}
          >
            {Object.entries(levelLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button disabled={save.isPending || !profile.isSuccess} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving skills…' : `Save ${count} skills`}
          </Button>
          <Button variant="outline" disabled={save.isPending} onClick={() => setSelected({})}>
            Clear selection
          </Button>
        </div>
      )}
      {profile.isError && (
        <p role="alert">Your saved skills could not load. Refresh before adding skills.</p>
      )}
      {query.isPending ? (
        <p role="status">Finding skills…</p>
      ) : query.isError ? (
        <>
          <p role="alert">{requestError(query.error)}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry search
          </Button>
        </>
      ) : (
        <>
          <p role="status">
            {available.length} suggestions. Narrow your search for more specific skills.
          </p>
          <div className="career-skill-grid">
            {available.map((skill) => (
              <label className="career-skill-choice" key={skill.id}>
                <input
                  type="checkbox"
                  disabled={save.isPending || !profile.isSuccess}
                  checked={!!selected[skill.id]}
                  onChange={() =>
                    setSelected((current) => {
                      const next = { ...current };
                      if (next[skill.id]) delete next[skill.id];
                      else next[skill.id] = skill.name;
                      return next;
                    })
                  }
                />
                <span>
                  <strong>{skill.name}</strong>
                  <small>{skill.category.replaceAll('-', ' ')}</small>
                </span>
              </label>
            ))}
          </div>
          {!query.data?.some((skill) => skill.name.toLowerCase() === search.trim().toLowerCase()) &&
            search.trim().length >= 2 &&
            search === deferred && (
              <div>
                <p>
                  No exact catalog entry? Review nearby spellings or save a custom skill. Custom
                  skills are kept in your profile but have no automatic role mapping.
                </p>
                <Button
                  variant="outline"
                  disabled={custom.isPending || !profile.isSuccess}
                  onClick={() => custom.mutate()}
                >
                  Add “{search.trim()}” as a custom skill
                </Button>
              </div>
            )}
        </>
      )}
      {(save.error || custom.error) && (
        <p role="alert">{requestError(save.error ?? custom.error)}</p>
      )}
      {save.isSuccess && <p role="status">Your selected skills were saved.</p>}
    </section>
  );
}
