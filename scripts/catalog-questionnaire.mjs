export function questionnaire(categories) {
  const option = (id, label, extra = {}) => ({ id, label, ...extra });
  return [
    {
      id: 'interest',
      prompt: 'Which area would you like to explore?',
      multiple: false,
      options: categories.map(({ id, name }) => option(id, name)),
    },
    {
      id: 'experience',
      prompt: 'How much practical experience do you have?',
      multiple: false,
      options: [
        option('new', 'I am getting started'),
        option('studying', 'I have studied or practised'),
        option('working', 'I have professional experience'),
      ],
    },
    {
      id: 'tools',
      prompt: 'Which have you actually used? Choose all that apply.',
      multiple: true,
      options: [
        option('none', 'None yet'),
        option('python', 'Python', {
          domains: ['development', 'ai-ml', 'data', 'other'],
          skill: 'Python',
        }),
        option('javascript', 'JavaScript', { domains: ['development'], skill: 'JavaScript' }),
        option('sql', 'SQL', { domains: ['development', 'data', 'finance'], skill: 'SQL' }),
        option('excel', 'Excel', {
          domains: ['data', 'finance', 'business', 'product-management'],
          skill: 'Excel',
        }),
        option('figma', 'Figma', { domains: ['design', 'development'], skill: 'Figma' }),
        option('photoshop', 'Photoshop', {
          domains: ['design', 'creative'],
          skill: 'Adobe Photoshop',
        }),
        option('linux', 'Linux', { domains: ['infrastructure', 'cybersecurity'], skill: 'Linux' }),
        option('docker', 'Docker', {
          domains: ['infrastructure', 'development', 'ai-ml'],
          skill: 'Docker',
        }),
        option('wireshark', 'Wireshark', {
          domains: ['cybersecurity', 'infrastructure'],
          skill: 'Wireshark',
        }),
        option('playwright', 'Playwright', {
          domains: ['quality', 'development'],
          skill: 'Playwright',
        }),
        option('jira', 'Jira', { domains: ['product-management', 'quality'], skill: 'Jira' }),
        option('quickbooks', 'QuickBooks', { domains: ['finance'], skill: 'QuickBooks' }),
        option('ga4', 'Google Analytics', {
          domains: ['business', 'data'],
          skill: 'Google Analytics 4',
        }),
        option('blender', 'Blender', { domains: ['creative', 'design'], skill: 'Blender' }),
        option('qgis', 'QGIS', { domains: ['other', 'data'], skill: 'QGIS' }),
        option('git', 'Git', {
          domains: ['development', 'ai-ml', 'infrastructure', 'quality'],
          skill: 'Git',
        }),
      ],
    },
    {
      id: 'enjoy',
      prompt: 'What kind of work do you enjoy most?',
      multiple: false,
      options: [
        option('build', 'Building practical things'),
        option('analyze', 'Analyzing evidence'),
        option('design', 'Designing experiences'),
        option('write', 'Writing and telling stories'),
        option('manage', 'Organizing people and projects'),
        option('secure', 'Finding risks and protecting systems'),
      ],
    },
    {
      id: 'weekly-hours',
      prompt: 'How much time can you usually learn each week?',
      multiple: false,
      options: [
        option('3', 'About 3 hours'),
        option('5', 'About 5 hours'),
        option('10', 'About 10 hours'),
        option('15', 'About 15 hours'),
      ],
    },
    {
      id: 'timeline',
      prompt: 'When would you like to review your progress?',
      multiple: false,
      options: [
        option('12', 'In 3 months'),
        option('26', 'In 6 months'),
        option('52', 'In a year'),
        option('flexible', 'I prefer a flexible timeline'),
      ],
    },
    {
      id: 'style',
      prompt: 'How do you prefer to learn?',
      multiple: false,
      options: [
        option('practice', 'Small practical projects'),
        option('reading', 'Reading documentation and examples'),
        option('video', 'Video demonstrations'),
        option('structured', 'A structured course'),
      ],
    },
    {
      id: 'starting-point',
      prompt: 'Which starting point fits you best?',
      multiple: false,
      options: [
        option('student', 'Student or recent graduate'),
        option('switcher', 'Changing career direction'),
        option('professional', 'Developing my current career'),
        option('exploring', 'Exploring possibilities'),
      ],
    },
  ];
}
