import { readFileSync, readdirSync } from 'node:fs';
import { z } from 'zod';
import { catalogSkillSchema, catalogRoleSchema } from '../backend/src/catalog/catalog.schemas.js';
import { validateCatalog } from '../backend/src/catalog/catalog.validation.js';
import { buildCatalogRoadmap } from '../backend/src/catalog/catalog.roadmaps.js';
import { catalogRoadmapSchema } from '../backend/src/catalog/catalog.schemas.js';

const root = new URL('../backend/prisma/data/catalog/', import.meta.url);
const read = (domain: string) =>
  readdirSync(new URL(domain, root))
    .filter((file) => file.endsWith('.json'))
    .flatMap(
      (file) => JSON.parse(readFileSync(new URL(`${domain}/${file}`, root), 'utf8')) as unknown[],
    );
const skills = catalogSkillSchema.array().parse(read('skills'));
const roles = catalogRoleSchema.array().parse(read('roles'));
console.log('Catalog validated:', validateCatalog(skills, roles));
for (const role of roles) {
  const roadmap = catalogRoadmapSchema.parse(buildCatalogRoadmap(role));
  const seen = new Set<string>();
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  for (const stage of roadmap.stages)
    for (const id of stage.skills) {
      if (seen.has(id)) throw new Error(`${role.id}: repeated roadmap skill ${id}`);
      for (const prerequisite of byId.get(id)!.prerequisites)
        if (!seen.has(prerequisite)) throw new Error(`${role.id}: prerequisite order ${id}`);
      seen.add(id);
    }
}
console.log(`Validated ${roles.length} role roadmaps and prerequisite order.`);
const requiredRoles = z
  .array(z.object({ title: z.string().min(2), category: z.string().min(2) }))
  .parse(JSON.parse(readFileSync(new URL('coverage.json', root), 'utf8')));
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[^a-z0-9]/g, '');
const titles = new Map(
  roles.flatMap((role) =>
    [role.name, ...role.aliases].map((name) => [normalize(name), role] as const),
  ),
);
for (const requirement of requiredRoles) {
  const role = titles.get(normalize(requirement.title));
  if (!role || role.category !== requirement.category)
    throw new Error(
      `Required role/category missing: ${requirement.title} (${requirement.category})`,
    );
}
console.log(
  `Covered all ${requiredRoles.length} requested role titles and categories, including merge aliases.`,
);
