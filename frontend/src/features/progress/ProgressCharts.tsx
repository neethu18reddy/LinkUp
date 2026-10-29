import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import type { ProgressSummary } from './progress.api';
export function ProgressCharts({ data }: { data: ProgressSummary }) {
  return (
    <div className="progress-charts">
      <section className="skills-card activity-chart">
        <h2>Learning time</h2>
        <div className="chart-total">
          <strong>{data.loggedMinutesLast7Days}</strong>
          <span>minutes in the last 7 days</span>
        </div>
        <p>Minutes logged across all goals, last seven UTC days.</p>
        {!data.daily.some((day) => day.minutes > 0) && (
          <p className="chart-empty">
            Your first session starts the story. Log a few minutes of learning to see it here.
          </p>
        )}
        <ResponsiveContainer
          width="100%"
          height={220}
          minWidth={0}
          initialDimension={{ width: 320, height: 220 }}
        >
          <BarChart data={data.daily} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--cloud-soft)" strokeDasharray="4 4" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => String(date).slice(5)}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--cloud-accent)', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={{ fill: 'var(--cloud-accent)', fontSize: 11 }}
              width={35}
            />
            <Tooltip
              cursor={{ fill: 'var(--cloud-soft)' }}
              contentStyle={{ borderRadius: 14, borderColor: 'var(--cloud-border)' }}
            />
            <Bar
              dataKey="minutes"
              name="Minutes learned"
              fill="var(--cloud-accent)"
              radius={[7, 7, 0, 0]}
              maxBarSize={36}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
        <details>
          <summary>View time data</summary>
          <ul>
            {data.daily.map((day) => (
              <li key={day.date}>
                {day.date}: {day.minutes} minutes
              </li>
            ))}
          </ul>
        </details>
      </section>
      <section className="skills-card skill-chart">
        <h2>Skill progress</h2>
        <p>
          Completed roadmap hours by skill; this is learning progress, not a proficiency assessment.
        </p>
        {data.skills.length >= 3 ? (
          <ResponsiveContainer
            width="100%"
            height={250}
            minWidth={0}
            initialDimension={{ width: 320, height: 250 }}
          >
            <RadarChart data={data.skills} accessibilityLayer>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" />
              <PolarRadiusAxis domain={[0, 100]} />
              <Radar
                dataKey="percent"
                fill="var(--cloud-accent)"
                stroke="var(--cloud-accent)"
                fillOpacity={0.3}
                isAnimationActive={false}
              />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <p>
            {data.skills.length
              ? 'Track your skill percentages below.'
              : 'Generate a roadmap to see skill progress.'}
          </p>
        )}
        <ul className="skill-progress-list">
          {data.skills.map((skill) => (
            <li key={skill.skillId}>
              <div>
                <span>{skill.name}</span>
                <strong>{skill.percent}%</strong>
              </div>
              <progress aria-label={`${skill.name} completion`} value={skill.percent} max={100} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
