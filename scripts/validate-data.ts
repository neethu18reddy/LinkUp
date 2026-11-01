import { readFileSync, readdirSync } from 'node:fs';
import { catalogSkillSchema, catalogRoleSchema } from '../backend/src/catalog/catalog.schemas.js';
import { validateCatalog } from '../backend/src/catalog/catalog.validation.js';

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
