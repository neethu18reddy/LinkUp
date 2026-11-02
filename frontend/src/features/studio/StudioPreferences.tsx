import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { type StudioSettings } from './studio.api';
import { useStudioSettings } from './useStudioSettings';
export function StudioPreferences() {
  const settings = useStudioSettings();
  const [draft, setDraft] = useState<StudioSettings | null>(null);
  const value = draft ?? settings.query.data;
  if (!value) return null;
  const set = <K extends keyof StudioSettings>(key: K, field: StudioSettings[K]) =>
    setDraft({ ...value, [key]: field });
  return (
    <details className="skills-card">
      <summary>My learning preferences</summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          settings.save.mutate(value, { onSuccess: () => setDraft(null) });
        }}
      >
        <div className="form-field">
          <label htmlFor="studio-timezone">My timezone (IANA name)</label>
          <input
            id="studio-timezone"
            value={value.timezone}
            onChange={(event) => set('timezone', event.target.value)}
            placeholder="Asia/Kolkata"
            required
          />
        </div>
        <div className="studio-form-grid">
          <div className="form-field">
            <label htmlFor="daily-goal-type">Daily goal</label>
            <select
              id="daily-goal-type"
              value={value.dailyGoalType}
              onChange={(event) => set('dailyGoalType', event.target.value as 'minutes' | 'videos')}
            >
              <option value="minutes">Minutes watched</option>
              <option value="videos">Videos completed</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="daily-goal-value">Goal amount</label>
            <input
              id="daily-goal-value"
              type="number"
              min={1}
              max={600}
              value={value.dailyGoalValue}
              onChange={(event) => set('dailyGoalValue', Number(event.target.value))}
              required
            />
          </div>
        </div>
        <label className="studio-check">
          <input
            type="checkbox"
            checked={value.autoplayNext}
            onChange={(event) => set('autoplayNext', event.target.checked)}
          />{' '}
          Play the next video automatically
        </label>
        <label className="studio-check">
          <input
            type="checkbox"
            checked={value.emojiRecap}
            onChange={(event) => set('emojiRecap', event.target.checked)}
          />{' '}
          Use a few emojis in my daily recap
        </label>
        <label className="studio-check">
          <input
            type="checkbox"
            checked={value.confirmSkillCompletion}
            onChange={(event) => set('confirmSkillCompletion', event.target.checked)}
          />{' '}
          Ask me to confirm a skill after its linked sections are complete
        </label>
        <div className="form-field">
          <label htmlFor="completion-threshold">Auto-complete after real watch time reaches</label>
          <select
            id="completion-threshold"
            value={value.completionThreshold}
            onChange={(event) => set('completionThreshold', Number(event.target.value))}
          >
            <option value={0.8}>80%</option>
            <option value={0.9}>90%</option>
            <option value={1}>100%</option>
          </select>
        </div>
        <Button disabled={settings.save.isPending}>Save learning preferences</Button>
        {settings.save.error && <p role="alert">{requestError(settings.save.error)}</p>}
        {settings.save.isSuccess && !draft && (
          <p role="status">
            Preferences saved. Earlier activity stays in its original daily bucket.
          </p>
        )}
      </form>
    </details>
  );
}
