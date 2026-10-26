export const dimensions = ['web', 'systems', 'data', 'design', 'operations'] as const;
export type InterestDimension = (typeof dimensions)[number];
export const questionIds = [
  'activity',
  'outcome',
  'challenge',
  'curiosity',
  'project',
  'feedback',
  'practice',
] as const;
const prompts = [
  'Which activity would you most like to try?',
  'What kind of result feels most satisfying?',
  'Which challenge sounds interesting?',
  'What are you most curious about?',
  'Which small project would you choose?',
  'What feedback would you most like to hear?',
  'How would you prefer to spend a practice session?',
];
const labels = [
  [
    'Build an interactive web page',
    'Connect an app to its data',
    'Find a pattern in a dataset',
    'Sketch an easier user experience',
    'Automate a repetitive technical task',
  ],
  [
    'A responsive interface people can use',
    'A reliable service behind an application',
    'A clear answer supported by evidence',
    'A design that makes a task simpler',
    'A smooth and repeatable release',
  ],
  [
    'Make an interface work on every screen',
    'Design a dependable API',
    'Explain why a metric changed',
    'Understand why users get stuck',
    'Investigate a deployment failure',
  ],
  [
    'How browsers turn code into interfaces',
    'How services store and exchange information',
    'How numbers help answer questions',
    'How people make choices in an app',
    'How applications run reliably',
  ],
  [
    'An interactive personal website',
    'A task-management API',
    'A dashboard explaining a dataset',
    'A clickable app prototype',
    'An automated build-and-release pipeline',
  ],
  [
    'The interface feels fast and usable',
    'The service is dependable and clear',
    'The analysis helped us decide',
    'The experience is easier to understand',
    'The release process is more reliable',
  ],
  [
    'Refine a web component',
    'Build and test a server endpoint',
    'Explore and visualize some data',
    'Test and improve a prototype',
    'Write a script to automate setup',
  ],
];
export const quizQuestions = questionIds.map((id, index) => ({
  id,
  prompt: prompts[index]!,
  options: dimensions.map((optionId, option) => ({ id: optionId, label: labels[index]![option]! })),
}));
export const dimensionReasons: Record<InterestDimension, string> = {
  web: 'building interactive interfaces',
  systems: 'reliable services and APIs',
  data: 'analysis and evidence',
  design: 'understanding users and improving experiences',
  operations: 'automation and dependable delivery',
};
export const roleAffinities: Record<string, Record<InterestDimension, number>> = {
  'frontend-developer': { web: 3, systems: 1, data: 0, design: 1, operations: 0 },
  'backend-developer': { web: 0, systems: 3, data: 1, design: 0, operations: 1 },
  'fullstack-developer': { web: 2, systems: 2, data: 0, design: 0, operations: 1 },
  'data-analyst': { web: 0, systems: 1, data: 3, design: 1, operations: 0 },
  'ui-designer': { web: 1, systems: 0, data: 1, design: 3, operations: 0 },
  'devops-engineer': { web: 0, systems: 2, data: 0, design: 0, operations: 3 },
};
