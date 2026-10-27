import type { CareerRole } from '../roles/roles.types.js';
import type { RoadmapDraft } from './roadmap.schemas.js';
import type { analyzeGaps } from './roadmap.gaps.js';
import { readFileSync } from 'node:fs';
import { z } from 'zod';

// Immutable role blueprints are loaded once, independently of personal skill data.
const blueprints = z
  .record(z.string(), z.object({ project: z.string(), steps: z.array(z.string()) }))
  .parse(
    JSON.parse(
      readFileSync(new URL('../../../prisma/data/roadmap-templates.json', import.meta.url), 'utf8'),
    ),
  );

// Reviewed, free official learning references; never links invented by a model.
export const learningResources: Record<string, { title: string; url: string }> = {
  HTML: {
    title: 'MDN: HTML',
    url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content',
  },
  CSS: {
    title: 'MDN: CSS',
    url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics',
  },
  JavaScript: {
    title: 'MDN: JavaScript',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
  },
  React: { title: 'React: Learn', url: 'https://react.dev/learn' },
  Git: { title: 'Pro Git', url: 'https://git-scm.com/book/en/v2' },
  Accessibility: { title: 'WAI tutorials', url: 'https://www.w3.org/WAI/tutorials/' },
  'Node.js': { title: 'Node.js: Learn', url: 'https://nodejs.org/en/learn' },
  Express: { title: 'Express guide', url: 'https://expressjs.com/en/guide/routing.html' },
  'REST APIs': {
    title: 'MDN: HTTP',
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview',
  },
  PostgreSQL: {
    title: 'PostgreSQL tutorial',
    url: 'https://www.postgresql.org/docs/current/tutorial.html',
  },
  SQL: {
    title: 'PostgreSQL SQL tutorial',
    url: 'https://www.postgresql.org/docs/current/tutorial-sql.html',
  },
  Python: { title: 'Python tutorial', url: 'https://docs.python.org/3/tutorial/' },
  Pandas: {
    title: 'pandas tutorials',
    url: 'https://pandas.pydata.org/docs/getting_started/intro_tutorials/',
  },
  Statistics: {
    title: 'OpenStax statistics',
    url: 'https://openstax.org/details/books/introductory-statistics-2e',
  },
  'Data Visualization': {
    title: 'Matplotlib tutorials',
    url: 'https://matplotlib.org/stable/tutorials/index.html',
  },
  Spreadsheets: {
    title: 'LibreOffice Calc guide',
    url: 'https://documentation.libreoffice.org/en/english-documentation/calc/',
  },
  Testing: { title: 'Node.js test runner', url: 'https://nodejs.org/api/test.html' },
};
export function buildTemplate(
  role: CareerRole,
  analysis: ReturnType<typeof analyzeGaps>,
): RoadmapDraft {
  if (!role.requirements.length)
    return {
      title: `${role.title}: learning roadmap`,
      phases: [
        {
          title: 'Explore and practice',
          description:
            'A general starter structure for your custom goal. Select subject-specific materials and adjust the scope as you learn.',
          topics: [
            {
              title: 'Define your outcome and learn the basics',
              skillId: null,
              subtopics: [
                `Write a measurable outcome for ${role.title}`,
                'Choose a trusted introductory course or reference',
                'Study the core concepts and write a short summary',
              ],
              estimatedHours: 4,
              difficulty: 'BEGINNER',
              resources: [],
              isProject: false,
            },
            {
              title: 'Practice with guided exercises',
              skillId: null,
              subtopics: [
                'Complete three small exercises relevant to your goal',
                'Keep notes on mistakes and unanswered questions',
                'Repeat one exercise without step-by-step instructions',
              ],
              estimatedHours: 6,
              difficulty: 'BEGINNER',
              resources: [],
              isProject: false,
            },
          ],
        },
        {
          title: 'Create something and reflect',
          description: 'Demonstrate your learning with a small project or practical outcome.',
          topics: [
            {
              title: 'Complete your custom goal project',
              skillId: null,
              subtopics: [
                'Define a practical outcome and clear acceptance criteria',
                'Create a project, demonstration or worked example',
                'Review the result, document evidence and choose your next steps',
              ],
              estimatedHours: 8,
              difficulty: 'INTERMEDIATE',
              resources: [],
              isProject: true,
            },
          ],
        },
      ],
    };
  const prerequisiteOrder = [
    'HTML',
    'CSS',
    'JavaScript',
    'TypeScript',
    'React',
    'Git',
    'Accessibility',
    'Node.js',
    'Express',
    'REST APIs',
    'SQL',
    'PostgreSQL',
    'Testing',
    'Spreadsheets',
    'Statistics',
    'Python',
    'Pandas',
    'Data Visualization',
  ];
  const requirements = [...(analysis.gaps.length ? analysis.gaps : analysis.strengths)].sort(
    (a, b) => {
      const rank = (name: string) => {
        const index = prerequisiteOrder.indexOf(name);
        return index < 0 ? 100 : index;
      };
      return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
    },
  );
  return {
    title: `${role.title}: learning roadmap`,
    phases: [
      {
        title: 'Build your foundations',
        description:
          'Work through prerequisite skills in order. Focus time reflects your current proficiency.',
        topics: requirements.map((row) => ({
          title: `${row.name}: ${row.currentLevel ? 'develop and practice' : 'fundamentals'}`,
          skillId: row.skillId,
          subtopics: [
            `Understand core ${row.name} concepts`,
            `Complete guided exercises`,
            'Explain your solution and review mistakes',
          ],
          estimatedHours: row.score === 0 ? 2 : row.currentLevel ? 6 : 12,
          difficulty: row.requiredLevel,
          resources: learningResources[row.name] ? [learningResources[row.name]!] : [],
          isProject: false,
        })),
      },
      {
        title: 'Apply and review',
        description: 'Combine the skills in a practical project and document what you learned.',
        topics: [
          {
            title: blueprints[role.slug]?.project ?? `${role.title} portfolio project`,
            skillId: null,
            subtopics: blueprints[role.slug]?.steps ?? [
              'Define a small real-world problem and acceptance criteria',
              'Build a working solution using the required skills',
              'Test the result and document setup, decisions, and limitations',
            ],
            estimatedHours: 16,
            difficulty: 'INTERMEDIATE',
            resources: [],
            isProject: true,
          },
        ],
      },
    ],
  };
}
