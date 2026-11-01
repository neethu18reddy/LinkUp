import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { families } from './catalog-source.mjs';
import { focus, ownership, roleCategories, entryRoles } from './catalog-focus.mjs';
import { questionnaire } from './catalog-questionnaire.mjs';
import { format } from 'prettier';
import { officialResources, descriptions } from './catalog-resources.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const formatting = read('.prettierrc.json');
const pendingWrites = [];
const save = (path, data) => {
  mkdirSync(new URL('.', new URL(path, root)), { recursive: true });
  pendingWrites.push(
    format(JSON.stringify(data), { ...formatting, parser: 'json' }).then((content) =>
      writeFileSync(new URL(path, root), content),
    ),
  );
};
const normalize = (text) =>
  text
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[^a-z0-9]/g, '');
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const uuid = (text) => {
  const hash = createHash('sha256').update(`linkup-catalog-v1:${text}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};
const oldSkills = read('backend/prisma/data/skills.json');
const oldRoles = read('backend/prisma/data/roles.json');
const skills = new Map(),
  roles = [];
const aliases = {
  JavaScript: ['js', 'ecmascript'],
  TypeScript: ['ts'],
  React: ['reactjs', 'react.js'],
  Vue: ['vuejs', 'vue.js'],
  'Node.js': ['node', 'nodejs'],
  'C#': ['csharp'],
  'C++': ['cpp'],
  '.NET': ['dotnet'],
  'REST APIs': ['rest', 'apis-rest', 'restful api'],
  PostgreSQL: ['postgres'],
  'Microsoft Azure': ['azure'],
  'Google Cloud': ['gcp', 'google cloud platform'],
  AWS: ['amazon web services'],
  'CI/CD': ['cicd'],
  'Retrieval-augmented Generation': ['rag'],
  'Large Language Models': ['llm'],
  'Search Engine Marketing': ['sem'],
  'Power BI': ['powerbi'],
  'UX Writing': ['ux copy'],
  'Financial Modeling': ['financial modelling'],
};
Object.assign(aliases, {
  Go: ['golang'],
  Python: ['py'],
  Bash: ['shell', 'unix shell'],
  'Google Analytics 4': ['ga4'],
  'Object-oriented Programming': ['oop'],
  'Machine Learning Fundamentals': ['ml', 'machine learning'],
  Mixing: ['sound mixing', 'audio mixing'],
  Collaboration: ['teamwork'],
  'Operating Systems': ['os', 'operating system fundamentals'],
  'Presentation Skills': ['presentation', 'public speaking'],
});
const prerequisites = {
  React: ['JavaScript', 'HTML', 'CSS'],
  Vue: ['JavaScript', 'HTML', 'CSS'],
  Angular: ['TypeScript', 'HTML', 'CSS'],
  TypeScript: ['JavaScript'],
  'Next.js': ['React'],
  Nuxt: ['Vue'],
  Redux: ['React'],
  'React Hooks': ['React'],
  'Vue Composition API': ['Vue'],
  'Angular Signals': ['Angular'],
  'Svelte Runes': ['Svelte'],
  Svelte: ['JavaScript', 'HTML', 'CSS'],
  'CSS Grid': ['CSS'],
  Flexbox: ['CSS'],
  'Node.js': ['JavaScript'],
  Express: ['Node.js'],
  NestJS: ['TypeScript', 'Node.js'],
  Fastify: ['Node.js'],
  Django: ['Python'],
  Flask: ['Python'],
  FastAPI: ['Python'],
  Pandas: ['Python'],
  NumPy: ['Python'],
  'Spring Boot': ['Java'],
  'Spring Security': ['Spring Boot'],
  Laravel: ['PHP'],
  'Ruby on Rails': ['Ruby'],
  Flutter: ['Dart'],
  SwiftUI: ['Swift'],
  UIKit: ['Swift'],
  'React Native': ['React'],
  'Jetpack Compose': ['Kotlin'],
  PyTorch: ['Python', 'Linear Algebra'],
  TensorFlow: ['Python'],
  'Hugging Face Transformers': ['Python', 'Transformers'],
  Transformers: ['Neural Networks'],
  'Neural Networks': ['Machine Learning Fundamentals', 'Linear Algebra'],
  'Retrieval-augmented Generation': ['Embeddings', 'Vector Search'],
  'Vector Search': ['Embeddings'],
  'LLM Fine-tuning': ['PyTorch'],
  LoRA: ['LLM Fine-tuning'],
  QLoRA: ['LoRA'],
  'Model Serving': ['Model Evaluation'],
  Kubernetes: ['Docker', 'Networking'],
  Helm: ['Kubernetes'],
  'Kubernetes Operators': ['Kubernetes'],
  'Kubernetes Autoscaling': ['Kubernetes'],
  'AWS EC2': ['AWS'],
  'AWS Lambda': ['AWS'],
  'AWS EKS': ['AWS', 'Kubernetes'],
  'Azure AKS': ['Microsoft Azure', 'Kubernetes'],
  'GCP GKE': ['Google Cloud', 'Kubernetes'],
  Terraform: ['Infrastructure as Code'],
  Ansible: ['Linux'],
  'GitHub Actions': ['Git', 'CI/CD'],
  dbt: ['SQL', 'Data Modeling'],
  PostgreSQL: ['SQL'],
  'Query Optimization': ['SQL'],
  'Apache Airflow': ['Python'],
  PySpark: ['Python', 'Apache Spark'],
  'Spatial SQL': ['SQL'],
  'Discounted Cash Flow Valuation': ['Financial Modeling', 'Valuation'],
  'Three-statement Modeling': ['Financial Accounting', 'Financial Modeling'],
  'M&A Modeling': ['Financial Modeling'],
  'Accretion Dilution Analysis': ['M&A Modeling'],
  'Portfolio Construction': ['Portfolio Theory'],
  'Options Pricing': ['Derivatives', 'Probability'],
  'Expected Credit Loss': ['Credit Risk'],
  'Financial Statement Preparation': ['Double-entry Accounting'],
  'Color Grading': ['Video Color Correction'],
  'Character Rigging': ['3D Modeling'],
  'Facial Animation': ['Character Animation'],
  'Quantum Algorithms': ['Quantum Circuits'],
  'Quantum Circuits': ['Linear Algebra'],
  'RNA-seq Analysis': ['Genomics', 'Statistics'],
};
Object.assign(prerequisites, {
  'Responsive Design': ['HTML', 'CSS'],
  'Web Performance': ['JavaScript'],
  'Server-side Rendering': ['JavaScript'],
  'Financial Modeling': ['Financial Accounting', 'Spreadsheets'],
  'Financial Ratio Analysis': ['Financial Accounting'],
  'Cash Flow Analysis': ['Financial Accounting'],
  'Account Reconciliation': ['Bookkeeping'],
  Bookkeeping: ['Double-entry Accounting'],
  Prototyping: ['Wireframing'],
  Wireframing: ['User Research'],
  'UI Design': ['Typography', 'Color Theory'],
  'Hypothesis Testing': ['Statistics', 'Probability'],
  'Linear Programming': ['Linear Algebra'],
  'Statistical Modeling': ['Statistics'],
  'Model Evaluation': ['Statistics'],
  'Data Visualization': ['Statistics'],
  ETL: ['SQL'],
  'Database Replication': ['SQL'],
  'Network Security': ['Networking'],
  'Memory Forensics': ['Digital Forensics'],
  '3D Animation': ['3D Modeling'],
  'Color Grading': ['Video Color Correction'],
  Mixing: ['Audio Signal Flow'],
  Mastering: ['Mixing'],
});
prerequisites.MATLAB = ['Linear Algebra'];
const related = {
  React: ['Vue', 'Angular', 'Svelte'],
  Vue: ['React', 'Svelte'],
  Angular: ['React', 'Vue'],
  Python: ['R', 'Julia'],
  R: ['Python'],
  Java: ['Kotlin', 'C#'],
  Kotlin: ['Java', 'Swift'],
  'C#': ['Java'],
  AWS: ['Microsoft Azure', 'Google Cloud'],
  'Microsoft Azure': ['AWS', 'Google Cloud'],
  'Power BI': ['Tableau'],
  Tableau: ['Power BI'],
  Figma: ['Sketch', 'Adobe XD'],
};
const labels = {
  development: 'Development',
  'ai-ml': 'AI & Machine Learning',
  data: 'Data',
  infrastructure: 'Infrastructure',
  cybersecurity: 'Cybersecurity',
  quality: 'Quality',
  design: 'Design',
  'product-management': 'Product & Project Management',
  finance: 'Finance & Accounting',
  business: 'Business, Marketing & Sales',
  creative: 'Arts, Media & Creative',
  other: 'Other high-demand fields',
};
const secondResource = {
  development: ['freeCodeCamp curriculum', 'https://www.freecodecamp.org/learn/'],
  'ai-ml': ['Google machine learning education', 'https://developers.google.com/machine-learning'],
  data: ['Kaggle Learn', 'https://www.kaggle.com/learn'],
  infrastructure: ['AWS Skill Builder', 'https://skillbuilder.aws/'],
  cybersecurity: ['OWASP learning resources', 'https://owasp.org/'],
  quality: ['Ministry of Testing resources', 'https://www.ministryoftesting.com/'],
  design: ['Interaction Design Foundation', 'https://www.interaction-design.org/'],
  'product-management': ['Atlassian teamwork guides', 'https://www.atlassian.com/team-playbook'],
  finance: ['OpenStax business textbooks', 'https://openstax.org/subjects/business'],
  business: ['OpenStax business textbooks', 'https://openstax.org/subjects/business'],
  creative: ['Adobe learning guides', 'https://www.adobe.com/learn'],
  other: ['OpenLearn courses', 'https://www.open.edu/openlearn/'],
};
for (const family of families) {
  for (const name of [...family.core, ...family.skills]) {
    const key = normalize(name);
    if (skills.has(key)) {
      const skill = skills.get(key);
      if (!skill.domains.includes(family.category)) skill.domains.push(family.category);
      continue;
    }
    const old = oldSkills.find((skill) => normalize(skill.name) === key);
    const extra = secondResource[family.category];
    const resources = [
      {
        title: `${family.id.replaceAll('-', ' ')} learning reference`,
        url: family.resource,
        type: 'course',
        free: !['https://www.cfainstitute.org/', 'https://www.garp.org/'].includes(family.resource),
      },
    ];
    if (extra[1] !== family.resource)
      resources.push({
        title: extra[0],
        url: extra[1],
        type: 'course',
        free: !['design', 'quality'].includes(family.category),
      });
    skills.set(key, {
      id: slug(name),
      databaseId: old?.id ?? uuid(`skill:${key}`),
      name: old?.name ?? name,
      aliases: [...new Set([...(old?.aliases ?? []), ...(aliases[name] ?? [])])],
      category: family.id,
      domains: [family.category],
      type: /Certification|Preparation$/.test(name)
        ? 'certification'
        : /Communication|Leadership|Empathy|Facilitation|Negotiation|Mentoring|Problem Solving/.test(
              name,
            )
          ? 'soft'
          : /^(React|Vue|Angular|Figma|Python|Java|SQL|CSS|HTML)$|AWS|Azure|GCP|Adobe|Blender|Studio|Framework|\.js|Tableau|Power BI|Kubernetes|Docker|Terraform/.test(
                name,
              )
            ? 'tool'
            : 'concept',
      level: /Advanced|Architect|Distributed|Quantum|Derivatives|Optimization|Forensic/.test(name)
        ? 'advanced'
        : family.core.includes(name)
          ? 'beginner'
          : 'intermediate',
      prerequisites: [],
      related: [],
      estimatedHours: family.core.includes(name) ? 16 : 12,
      demand: ['ai-ml', 'cybersecurity', 'infrastructure', 'data'].includes(family.category)
        ? 'high'
        : 'medium',
      trending: ['ai-ml', 'cybersecurity'].includes(family.category),
      description: `${name} supports the practical knowledge needed to ${family.purpose}.`,
      resources,
    });
  }
}
// Preserve every original skill, including a name not otherwise present in the new taxonomy.
for (const old of oldSkills)
  if (!skills.has(normalize(old.name))) {
    const family = families.find((entry) => entry.id === 'backend-services');
    skills.set(normalize(old.name), {
      ...skills.get(normalize('Testing')),
      id: slug(old.name),
      databaseId: old.id,
      name: old.name,
      aliases: old.aliases,
      category: family.id,
      domains: ['development'],
      prerequisites: [],
      related: [],
      description: `${old.name} supports maintainable applications and practical problem solving.`,
    });
    family.skills.push(old.name);
  }
const byName = (name) => {
  const skill = skills.get(normalize(name));
  if (!skill) throw new Error(`Unknown skill ${name}`);
  return skill;
};
const softFoundations = new Set([
  'Collaboration',
  'Critical Thinking',
  'Time Management',
  'Adaptability',
  'Ownership',
  'Presentation Skills',
  'Empathy',
  'Active Listening',
]);
for (const skill of skills.values()) {
  if (softFoundations.has(skill.name)) {
    skill.type = 'soft';
    skill.level = 'beginner';
    skill.domains = [...new Set([...skill.domains, ...Object.keys(labels)])];
  }
  if (skill.name === 'MATLAB') {
    skill.type = 'technical';
    skill.domains = [...new Set([...skill.domains, 'data'])];
  }
  skill.aliases = [...new Set([...skill.aliases, ...(aliases[skill.name] ?? [])])];
  skill.estimatedHours =
    {
      Python: 40,
      JavaScript: 40,
      TypeScript: 24,
      React: 40,
      CSS: 24,
      HTML: 16,
      SQL: 32,
      Git: 8,
      Statistics: 40,
      'Financial Modeling': 32,
      MATLAB: 40,
      'Operating Systems': 32,
      Collaboration: 8,
      'Critical Thinking': 12,
      'Time Management': 8,
      Adaptability: 8,
      Ownership: 8,
      'Presentation Skills': 12,
      Empathy: 8,
      'Active Listening': 8,
    }[skill.name] ?? (skill.level === 'advanced' ? 32 : skill.level === 'beginner' ? 12 : 16);
  const official = officialResources[skill.name];
  if (official && !skill.resources.some((resource) => resource.url === official))
    skill.resources.unshift({
      title: `${skill.name} official learning reference`,
      url: official,
      type: 'docs',
      free: true,
    });
  if (descriptions[skill.name]) skill.description = descriptions[skill.name];
  if (skill.resources.length < 2)
    skill.resources.push({
      title: 'OpenLearn learning library',
      url: 'https://www.open.edu/openlearn/',
      type: 'course',
      free: true,
    });
  skill.prerequisites = (prerequisites[skill.name] ?? []).map((name) => byName(name).id);
  skill.related = (related[skill.name] ?? []).map((name) => byName(name).id);
}
const roleAliases = {
  'Full Stack Developer': ['Fullstack Developer'],
  'Penetration Tester': ['Ethical Hacker'],
  'Technical Writer / Developer Advocate': ['Developer Advocate'],
  'Digital Artist/Illustrator': ['Digital Illustrator'],
  'Stream er/Community Manager': ['Streamer'],
  'Django/Flask Developer': ['Django Developer', 'Flask Developer'],
};
for (const family of families) {
  const coreIds = [...new Set(family.core.map((name) => byName(name).id))];
  const pool = [...new Set(family.skills.map((name) => byName(name).id))].filter(
    (id) => !coreIds.includes(id),
  );
  const familyRoles = family.roles.filter((name) => name !== 'Ethical Hacker');
  if (pool.length > familyRoles.length * (15 - coreIds.length))
    throw new Error(`Too few role slots in ${family.id}`);
  familyRoles.forEach((name) => {
    const old = oldRoles.find(
      (role) =>
        normalize(role.title) === normalize(name) ||
        (name === 'Full Stack Developer' && role.slug === 'fullstack-developer'),
    );
    // Subject terms pull the matching platform into that specialist's core requirements.
    const own = pool.filter((id) => {
      const term = [...skills.values()].find((skill) => skill.id === id).name;
      return term.length >= 3 && name.toLowerCase().includes(term.toLowerCase());
    });
    const ids = [
      ...new Set([...(focus[name] ?? []).map((term) => byName(term).id), ...own, ...coreIds]),
    ];
    if (ids.length > 15) throw new Error(`Too many skills: ${name}`);
    roles.push({
      id: old?.slug ?? slug(name),
      databaseId: old?.id ?? uuid(`role:${normalize(name)}`),
      name,
      category: family.category,
      family: family.id,
      description:
        old?.description ??
        `${family.purpose.charAt(0).toUpperCase()}${family.purpose.slice(1)} with a focus on ${name.toLowerCase()} practice.`,
      experienceBand: /Architect|Manager|Director|Lead|Scientist \(AI\)|Coach/.test(name)
        ? 'senior'
        : /Associate|Support|Help Desk|Bookkeeper|Annotation/.test(name)
          ? 'entry'
          : 'mid',
      trending:
        ['ai-ml', 'cybersecurity', 'infrastructure', 'data'].includes(family.category) ||
        /Fintech/.test(name),
      demand: ['ai-ml', 'cybersecurity', 'infrastructure', 'data'].includes(family.category)
        ? 'high'
        : 'medium',
      keywords: [
        family.category,
        family.id,
        ...name
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean),
      ],
      aliases: roleAliases[name] ?? [],
      skills: ids.map((skillId, position) => ({
        skillId,
        importance:
          position < Math.max(4, own.length) ? 'core' : position < 8 ? 'important' : 'nice-to-have',
        requiredLevel: position < 4 ? 'intermediate' : 'beginner',
        weight: position < 4 ? 3 : 1,
      })),
      relatedRoles: [],
      careerPath: { from: [], to: [] },
      project: `${name}: ${family.project.charAt(0).toLowerCase()}${family.project.slice(1)}.`,
      checkpoint: `Demonstrate ${ids
        .slice(0, 3)
        .map((id) => [...skills.values()].find((skill) => skill.id === id).name)
        .join(
          ', ',
        )} in the project, justify decisions and document limitations without following a walkthrough.`,
    });
  });
  const members = roles.filter((role) => role.family === family.id);
  for (const skillId of pool) {
    if (members.some((role) => role.skills.some((row) => row.skillId === skillId))) continue;
    const name = [...skills.values()].find((skill) => skill.id === skillId).name;
    const hints = ownership.filter(([pattern]) => pattern.test(name));
    const candidates = members.filter((role) => role.skills.length < 15);
    candidates.sort((a, b) => {
      const relevance = (role) =>
        hints.reduce((sum, [, pattern]) => sum + (pattern.test(role.name) ? 100 : 0), 0) +
        name
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((word) => word.length > 3 && role.name.toLowerCase().includes(word)).length *
          10;
      return (
        relevance(b) - relevance(a) || a.skills.length - b.skills.length || a.id.localeCompare(b.id)
      );
    });
    if (!candidates[0]) throw new Error(`No role capacity for ${name}`);
    candidates[0].skills.push({
      skillId,
      importance: candidates[0].skills.length < 8 ? 'important' : 'nice-to-have',
      requiredLevel: 'beginner',
      weight: 1,
    });
  }
  for (const role of members)
    for (const skillId of pool) {
      if (role.skills.length >= 6) break;
      if (!role.skills.some((row) => row.skillId === skillId))
        role.skills.push({
          skillId,
          importance: 'important',
          requiredLevel: 'beginner',
          weight: 1,
        });
    }
}
// Ensure every pre-existing role remains selectable even if its display label differs.
for (const old of oldRoles)
  if (!roles.some((role) => role.databaseId === old.id))
    throw new Error(`Original role missing: ${old.title}`);
const skillsByContentId = new Map([...skills.values()].map((skill) => [skill.id, skill]));
for (const role of roles) {
  role.category = roleCategories[role.name] ?? role.category;
  if (entryRoles.includes(role.name)) role.experienceBand = 'entry';
  if (['ai-ml', 'data', 'infrastructure', 'cybersecurity'].includes(role.category)) {
    role.trending = true;
    role.demand = 'high';
  }
  for (const row of role.skills) {
    const skill = skillsByContentId.get(row.skillId);
    if (!skill.domains.includes(role.category)) skill.domains.push(role.category);
  }
}
for (const role of roles) {
  const siblings = roles.filter((other) => other.family === role.family && other.id !== role.id);
  role.relatedRoles = siblings.slice(0, 3).map((other) => other.id);
  role.careerPath = {
    from: siblings
      .filter(
        (other) =>
          other.experienceBand === 'entry' ||
          (role.experienceBand === 'senior' && other.experienceBand === 'mid'),
      )
      .slice(0, 2)
      .map((other) => other.id),
    to: siblings
      .filter((other) => other.experienceBand === 'senior' && role.experienceBand !== 'senior')
      .slice(0, 2)
      .map((other) => other.id),
  };
}
const dataRoot = 'backend/prisma/data/catalog/';
for (const category of Object.keys(labels)) {
  save(
    `${dataRoot}skills/${category}.json`,
    [...skills.values()].filter((skill) => skill.domains[0] === category),
  );
  save(
    `${dataRoot}roles/${category}.json`,
    roles.filter((role) => role.category === category),
  );
}
save(
  `${dataRoot}categories.json`,
  Object.entries(labels).map(([id, name]) => ({ id, name })),
);
save(
  `${dataRoot}questionnaire.json`,
  questionnaire(Object.entries(labels).map(([id, name]) => ({ id, name }))),
);
save(
  `${dataRoot}aliases.json`,
  Object.fromEntries(roles.flatMap((role) => role.aliases.map((alias) => [alias, role.id]))),
);
save(
  `${dataRoot}families.json`,
  families.map((family) => ({
    id: family.id,
    category: family.category,
    purpose: family.purpose,
    resource: family.resource,
    project: family.project,
  })),
);
console.log(
  `Authored catalog: ${skills.size} skills, ${roles.length} roles, ${families.length} families`,
);
await Promise.all(pendingWrites);
