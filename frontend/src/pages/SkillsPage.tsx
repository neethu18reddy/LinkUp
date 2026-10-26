import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import {
  addProfileSkill,
  getCatalogue,
  getProfileSkills,
  levelLabels,
  levelSchema,
  removeProfileSkill,
  skillKeys,
  updateProfileSkill,
  type ProfileSkill,
  type SkillLevel,
} from '@/features/skills/skills.api';

function SkillRow({ entry }: { entry: ProfileSkill }) {
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const update = useMutation({
    mutationFn: updateProfileSkill,
    onSuccess: () => {
      setMessage('Level saved.');
      toast.success(`${entry.skill.name} updated`);
      return client.invalidateQueries({ queryKey: skillKeys.profile });
    },
  });
  const remove = useMutation({
    mutationFn: removeProfileSkill,
    onSuccess: () => {
      toast.success(`${entry.skill.name} removed`);
      return client.invalidateQueries({ queryKey: skillKeys.profile });
    },
  });
  const pending = update.isPending || remove.isPending;
  return (
    <li className="profile-skill-row">
      <div className="profile-skill-name">
        <strong>{entry.skill.name}</strong>
        <span>{entry.skill.category}</span>
      </div>
      <div className="profile-skill-actions">
        <label className="sr-only" htmlFor={`level-${entry.skillId}`}>
          Level for {entry.skill.name}
        </label>
        <select
          id={`level-${entry.skillId}`}
          value={entry.level}
          disabled={pending || confirming}
          onChange={(event) => {
            setMessage('');
            update.reset();
            remove.reset();
            update.mutate({ skillId: entry.skillId, level: levelSchema.parse(event.target.value) });
          }}
        >
          {Object.entries(levelLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="remove-skill"
          aria-label={`Remove ${entry.skill.name}`}
          disabled={pending || confirming}
          onClick={() => {
            remove.reset();
            setConfirming(true);
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      {confirming && (
        <div
          className="remove-confirmation"
          role="group"
          aria-label={`Confirm removal of ${entry.skill.name}`}
        >
          <p>Remove {entry.skill.name} from your profile?</p>
          <Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
            Keep skill
          </Button>
          <Button disabled={pending} onClick={() => remove.mutate(entry.skillId)}>
            {remove.isPending ? 'Removing…' : 'Remove skill'}
          </Button>
        </div>
      )}
      {(update.isPending || message) && (
        <p className="skill-feedback" role="status">
          {update.isPending ? 'Saving level…' : message}
        </p>
      )}
      {(update.error || remove.error) && (
        <p className="field-error skill-row-error" role="alert">
          {requestError(update.error ?? remove.error)}
        </p>
      )}
    </li>
  );
}

export function SkillsPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [level, setLevel] = useState<SkillLevel>('BEGINNER');
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const profile = useQuery({ queryKey: skillKeys.profile, queryFn: getProfileSkills });
  const catalogue = useQuery({
    queryKey: skillKeys.catalogue(debouncedSearch),
    queryFn: () => getCatalogue(debouncedSearch),
  });
  const add = useMutation({
    mutationFn: addProfileSkill,
    onSuccess: (entry) => {
      setSelected('');
      setFeedback(`${entry.skill.name} added to your profile.`);
      toast.success(`${entry.skill.name} added`);
      return client.invalidateQueries({ queryKey: skillKeys.profile });
    },
  });
  const available = (catalogue.data ?? []).filter(
    (entry) => !profile.data?.some((saved) => saved.skillId === entry.id),
  );
  const selectionValid = available.some((entry) => entry.id === selected);
  const searchPending = search.trim() !== debouncedSearch;
  const canAdd =
    !!profile.data &&
    !profile.isError &&
    !catalogue.isError &&
    !catalogue.isPending &&
    !searchPending &&
    selectionValid &&
    !add.isPending;
  return (
    <AccountLayout>
      <main className="dashboard-main skills-page">
        <p className="eyebrow">YOUR STARTING POINT</p>
        <h1>What do you know?</h1>
        <p className="auth-description">
          Build a picture of your skills. Choose the level that feels right today—you can change it
          any time.
        </p>
        <section className="skills-card" aria-labelledby="add-skill-title">
          <h2 id="add-skill-title">Add a skill</h2>
          <form
            aria-label="Add a skill"
            onSubmit={(event) => {
              event.preventDefault();
              if (canAdd) {
                setFeedback('');
                add.mutate({ skillId: selected, level });
              }
            }}
          >
            <div className="form-field">
              <label htmlFor="skill-search">Search the catalogue</label>
              <input
                id="skill-search"
                type="search"
                placeholder="Try React, Python, or design"
                maxLength={100}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSelected('');
                  add.reset();
                  setFeedback('');
                }}
              />
            </div>
            {catalogue.isPending || searchPending ? (
              <p role="status" className="field-hint">
                Finding skills…
              </p>
            ) : catalogue.isError ? (
              <div className="inline-query-error">
                <p role="alert">{requestError(catalogue.error)}</p>
                <Button variant="outline" onClick={() => void catalogue.refetch()} type="button">
                  Retry catalogue
                </Button>
              </div>
            ) : (
              <>
                {catalogue.data?.length === 0 ? (
                  <p className="skill-empty" role="status">
                    No skills match “{debouncedSearch}”. Try another name.
                  </p>
                ) : available.length === 0 ? (
                  <p className="skill-empty" role="status">
                    You’ve already added all matching skills.
                  </p>
                ) : (
                  <div className="skill-add-fields">
                    <div className="form-field">
                      <label htmlFor="skill-choice">Skill</label>
                      <select
                        id="skill-choice"
                        value={selectionValid ? selected : ''}
                        onChange={(event) => {
                          setSelected(event.target.value);
                          add.reset();
                          setFeedback('');
                        }}
                        disabled={add.isPending}
                      >
                        <option value="">Choose a skill</option>
                        {available.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} · {entry.category}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label htmlFor="skill-level">Your level</label>
                      <select
                        id="skill-level"
                        value={level}
                        onChange={(event) => {
                          setLevel(levelSchema.parse(event.target.value));
                          add.reset();
                        }}
                        disabled={add.isPending}
                      >
                        {Object.entries(levelLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}
            <Button type="submit" disabled={!canAdd}>
              <Plus size={16} aria-hidden="true" />
              {add.isPending ? 'Adding skill…' : 'Add skill'}
            </Button>
            <p className="field-hint">
              Beginner: learning the basics · Intermediate: working independently · Advanced:
              confident with complex work
            </p>
            {add.error && (
              <p className="field-error" role="alert">
                {requestError(add.error)}
              </p>
            )}
            {feedback && (
              <p className="skill-feedback" role="status">
                {feedback}
              </p>
            )}
          </form>
        </section>
        <section className="skills-card" aria-labelledby="profile-skills-title">
          <div className="skills-section-heading">
            <h2 id="profile-skills-title">Your skills</h2>
            {profile.data && (
              <span>
                {profile.data.length} {profile.data.length === 1 ? 'skill' : 'skills'}
              </span>
            )}
          </div>
          {profile.isPending ? (
            <p className="skill-empty" role="status">
              Loading your skills…
            </p>
          ) : profile.isError ? (
            <div className="inline-query-error">
              <p role="alert">{requestError(profile.error)}</p>
              <Button variant="outline" onClick={() => void profile.refetch()}>
                Retry your skills
              </Button>
            </div>
          ) : profile.data.length === 0 ? (
            <p className="skill-empty">
              A blank page is a good place to start. Add your first skill above.
            </p>
          ) : (
            <ul className="profile-skills-list">
              {profile.data.map((entry) => (
                <SkillRow key={entry.skillId} entry={entry} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </AccountLayout>
  );
}
