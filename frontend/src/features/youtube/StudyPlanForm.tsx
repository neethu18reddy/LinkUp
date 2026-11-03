import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { type PlanningPreferences, type StudySchedule } from './youtube.api';
import './youtube.css';
export function StudyScheduleView({
  schedule,
  resourceId,
}: {
  schedule: StudySchedule;
  resourceId?: string;
}) {
  const [visible, setVisible] = useState(14);
  return (
    <section aria-label="Study schedule">
      <h2>Your study schedule</h2>
      <p>
        {schedule.days.length} study days · {Math.ceil(schedule.totalMinutes)} minutes including
        suggested practice · finishes {schedule.completionDate}
      </p>
      <p className="field-hint">{schedule.basis}</p>
      {schedule.warning && (
        <p role="status" className="youtube-status">
          {schedule.warning}
        </p>
      )}
      <div className="youtube-schedule">
        {schedule.days.slice(0, visible).map((day) => (
          <article className="youtube-day" key={day.date}>
            <h3>
              {day.date} · {Math.ceil(day.minutes)} min
            </h3>
            <ol>
              {day.tasks.map((task, i) => (
                <li key={i}>
                  <strong>
                    {task.kind === 'watch'
                      ? 'Watch'
                      : task.kind === 'practice'
                        ? 'Practice'
                        : 'Review'}
                  </strong>
                  : {task.title} · {Math.ceil(task.seconds / 60)} min{' '}
                  {task.kind === 'watch' && (
                    <span>
                      ({Math.floor((task.startSec ?? 0) / 60)}:
                      {String((task.startSec ?? 0) % 60).padStart(2, '0')}–
                      {Math.floor((task.endSec ?? 0) / 60)}:
                      {String((task.endSec ?? 0) % 60).padStart(2, '0')})
                    </span>
                  )}
                  {task.estimated && ' · estimated'}{' '}
                  {resourceId && task.itemId && (
                    <Link
                      to={`/studio/${resourceId}/study?item=${task.itemId}&at=${task.startSec ?? 0}`}
                    >
                      Open learning session
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
      {schedule.days.length > visible && (
        <Button variant="outline" onClick={() => setVisible(visible + 14)}>
          Show next 14 study days
        </Button>
      )}
    </section>
  );
}
export function StudyPlanForm({
  initial,
  unknownItems,
  build,
  save,
  initialSchedule,
  resourceId,
  saveLabel = 'Save study plan',
}: {
  initial: PlanningPreferences;
  unknownItems: { id: string; title: string }[];
  build: (preferences: PlanningPreferences) => Promise<StudySchedule>;
  save: (preferences: PlanningPreferences) => Promise<unknown>;
  initialSchedule?: StudySchedule;
  resourceId?: string;
  saveLabel?: string;
}) {
  const [preferences, setPreferences] = useState(initial),
    [schedule, setSchedule] = useState<StudySchedule | null>(initialSchedule ?? null);
  const preview = useMutation({ mutationFn: build, onSuccess: setSchedule }),
    persist = useMutation({ mutationFn: save });
  function change(patch: Partial<PlanningPreferences>) {
    setPreferences({ ...preferences, ...patch });
    setSchedule(null);
    preview.reset();
    persist.reset();
  }
  return (
    <section className="youtube-plan-card">
      <h2>Make a plan that fits your week</h2>
      <p>Choose your goal and availability. We’ll keep your career roadmap separate.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          preview.mutate(preferences);
        }}
      >
        <div className="youtube-preferences">
          <div className="form-field">
            <label htmlFor="yt-plan-goal">What do you want to learn?</label>
            <input
              id="yt-plan-goal"
              value={preferences.goal}
              onChange={(e) => change({ goal: e.target.value })}
              required
              minLength={2}
              maxLength={200}
            />
          </div>
          <div className="form-field">
            <label htmlFor="yt-plan-level">Your level</label>
            <select
              id="yt-plan-level"
              value={preferences.level}
              onChange={(e) => change({ level: e.target.value as PlanningPreferences['level'] })}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="yt-plan-language">Preferred language</label>
            <select
              id="yt-plan-language"
              value={preferences.language}
              onChange={(e) =>
                change({ language: e.target.value as PlanningPreferences['language'] })
              }
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="both">Hindi and English</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="yt-plan-minutes">Minutes per study day</label>
            <input
              id="yt-plan-minutes"
              type="number"
              min={10}
              max={240}
              required
              value={preferences.dailyMinutes}
              onChange={(e) => change({ dailyMinutes: Number(e.target.value) })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="yt-plan-start">Start date</label>
            <input
              id="yt-plan-start"
              type="date"
              required
              value={preferences.startDate}
              onChange={(e) => change({ startDate: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="yt-plan-deadline">Deadline (optional)</label>
            <input
              id="yt-plan-deadline"
              type="date"
              min={preferences.startDate}
              value={preferences.targetDate ?? ''}
              onChange={(e) => change({ targetDate: e.target.value || null })}
            />
          </div>
          <fieldset>
            <legend>Study days</legend>
            <div className="youtube-weekdays">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name, i) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    checked={preferences.weekdays.includes(i + 1)}
                    onChange={(e) =>
                      change({
                        weekdays: e.target.checked
                          ? [...preferences.weekdays, i + 1]
                          : preferences.weekdays.filter((d) => d !== i + 1),
                      })
                    }
                  />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
          {!!unknownItems.length && (
            <fieldset className="youtube-unknown">
              <legend>Estimated video duration required</legend>
              {unknownItems.map((item) => (
                <div className="form-field" key={item.id}>
                  <label htmlFor={`estimate-${item.id}`}>{item.title} — minutes</label>
                  <input
                    id={`estimate-${item.id}`}
                    type="number"
                    min={1}
                    max={1440}
                    required
                    value={
                      preferences.estimates[item.id] ? preferences.estimates[item.id]! / 60 : ''
                    }
                    onChange={(e) =>
                      change({
                        estimates: {
                          ...preferences.estimates,
                          [item.id]: Number(e.target.value) * 60,
                        },
                      })
                    }
                  />
                </div>
              ))}
            </fieldset>
          )}
        </div>
        <p className="field-hint">
          Dates use {preferences.timezone}. Seek actions do not count as watched time; practice and
          review are suggestions.
        </p>
        <Button
          type="submit"
          disabled={!preferences.weekdays.length || preview.isPending || persist.isPending}
        >
          {preview.isPending ? 'Building schedule…' : 'Preview study schedule'}
        </Button>
      </form>
      {preview.isError && <p role="alert">{requestError(preview.error)}</p>}
      {schedule && (
        <>
          <StudyScheduleView schedule={schedule} resourceId={resourceId} />
          <Button
            onClick={() => persist.mutate(preferences)}
            disabled={persist.isPending || preview.isPending}
          >
            {persist.isPending ? 'Saving plan…' : saveLabel}
          </Button>
        </>
      )}
      {persist.isError && (
        <p role="alert">
          {requestError(persist.error)} Your preview is kept; you can retry saving.
        </p>
      )}
      {persist.isSuccess && <p role="status">Study plan saved.</p>}
    </section>
  );
}
