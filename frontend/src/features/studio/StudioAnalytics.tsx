import type { StudioAnalytics as Analytics } from './studio.api';
import { duration } from './studio.api';
export function StudioAnalytics({ data }: { data: Analytics }) {
  const maximum = Math.max(60, ...data.daily.map((day) => day.secondsWatched));
  return (
    <>
      <section className="skills-card">
        <h2>Your learning rhythm</h2>
        <div className="studio-metrics">
          <div>
            <strong>{data.percent}%</strong>
            <span>
              {data.completedItems}/{data.totalItems} items complete
            </span>
          </div>
          <div>
            <strong>{duration(data.watchedSec)}</strong>
            <span>Real watch time · {duration(data.durationSec)} known content</span>
          </div>
          <div>
            <strong>{data.streak.current} days</strong>
            <span>Current streak · longest {data.streak.longest}</span>
          </div>
          <div>
            <strong>{data.eta ?? 'A little more practice'}</strong>
            <span>
              {data.eta
                ? 'Estimated finish at recent pace'
                : 'ETA appears after study time is recorded'}
            </span>
          </div>
        </div>
        <p>
          Typical session: {data.averageSessionMinutes} min · Most active hour:{' '}
          {data.bestHour ? `${data.bestHour}:00` : 'Not enough activity yet'} · Most active day:{' '}
          {data.bestWeekday
            ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][
                Number(data.bestWeekday) - 1
              ]
            : 'Not enough activity yet'}
          .
        </p>
        <p>
          {data.notes} saved notes · {data.snippets} snippets · {data.runs} code runs. Today’s daily
          goal: {data.goal.actual}/{data.goal.target} {data.goal.type} ({data.goal.pace}).
        </p>
        <p className="field-hint">
          Dates use {data.timezone}. Time estimates use known durations and the last seven days of
          real watch time. Older manual logs are shown separately.
        </p>
      </section>
      <section className="skills-card">
        <h2>Daily practice</h2>
        <p>
          {Math.round(data.daily.reduce((sum, day) => sum + day.secondsWatched, 0) / 60)} minutes
          watched and {data.daily.reduce((sum, day) => sum + day.videosCompleted, 0)} first-time
          completions in this range.
        </p>
        <figure aria-label="Daily minutes watched">
          <div className="studio-chart" aria-hidden="true">
            {data.daily.map((day) => (
              <div
                key={day.date}
                style={{ height: `${Math.max(2, (day.secondsWatched / maximum) * 100)}%` }}
                title={`${day.date}: ${Math.round(day.secondsWatched / 60)} minutes`}
              />
            ))}
          </div>
          <figcaption>
            Daily minutes watched · {data.daily[0]?.date} to {data.today}
          </figcaption>
        </figure>
        <div className="studio-heatmap" aria-label="Study-day calendar">
          {data.daily.map((day) => (
            <span
              role="img"
              key={day.date}
              aria-label={`${day.date}: ${Math.round(day.secondsWatched / 60)} watched minutes, ${day.videosCompleted} videos completed${day.legacyMinutes ? `, ${day.legacyMinutes} earlier logged minutes` : ''}`}
              title={`${day.date} · ${Math.round(day.secondsWatched / 60)} min`}
              style={{
                background:
                  day.secondsWatched >= 1800
                    ? '#7954a4'
                    : day.secondsWatched > 0 ||
                        day.videosCompleted > 0 ||
                        day.notes > 0 ||
                        day.snippets > 0
                      ? '#b49bcc'
                      : day.legacyMinutes
                        ? '#d2c2e2'
                        : '#f5f1f9',
              }}
            />
          ))}
        </div>
        <details>
          <summary>Read chart data as a table</summary>
          <div style={{ overflowX: 'auto' }}>
            <table className="studio-data-table">
              <caption>Daily learning history in {data.timezone}</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Watched min</th>
                  <th scope="col">Videos</th>
                  <th scope="col">Notes</th>
                  <th scope="col">Snippets</th>
                  <th scope="col">Earlier logged min</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{day.date}</th>
                    <td>{Math.round(day.secondsWatched / 60)}</td>
                    <td>{day.videosCompleted}</td>
                    <td>{day.notes}</td>
                    <td>{day.snippets}</td>
                    <td>{day.legacyMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="field-hint">
          A new local day starts at zero without clearing earlier activity. A reopened video does
          not inflate first-time completion totals.
        </p>
      </section>
      {!!data.topicTags.length && (
        <section className="skills-card">
          <h2>Topics you’ve been exploring</h2>
          <div className="goal-filters">
            {data.topicTags.map((topic) => (
              <span className="journey-status" key={topic}>
                {topic}
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
