import {
  ResponsiveContainer,
  BarChart,
  Bar,
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
      <section className="skills-card">
        <h2>Learning time</h2>
        <p>Minutes logged across all goals, last seven UTC days.</p>
        <ResponsiveContainer
          width="100%"
          height={220}
          minWidth={0}
          initialDimension={{ width: 320, height: 220 }}
        >
          <BarChart data={data.daily} accessibilityLayer>
            <XAxis dataKey="date" tickFormatter={(date) => String(date).slice(5)} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="minutes" fill="#285b46" isAnimationActive={false} />
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
      <section className="skills-card">
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
                fill="#4f795e"
                stroke="#285b46"
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
        <ul>
          {data.skills.map((skill) => (
            <li key={skill.skillId}>
              {skill.name}: {skill.percent}%
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
