import { readFileSync, readdirSync } from 'node:fs';
import { z } from 'zod';
import { catalogRoleSchema, catalogSkillSchema } from './catalog.schemas.js';
import { validateCatalog, orderSkills } from './catalog.validation.js';

const root = new URL('../../prisma/data/catalog/', import.meta.url);
function readDomain(directory: string): unknown[] {
  return readdirSync(new URL(directory, root))
    .filter((file) => file.endsWith('.json'))
    .flatMap(
      (file) =>
        JSON.parse(readFileSync(new URL(`${directory}/${file}`, root), 'utf8')) as unknown[],
    );
}
export const catalogSkills = catalogSkillSchema.array().parse(readDomain('skills'));
export const catalogRoles = catalogRoleSchema.array().parse(readDomain('roles'));
validateCatalog(catalogSkills, catalogRoles);
export const categories = z
  .array(z.object({ id: z.string(), name: z.string() }))
  .parse(JSON.parse(readFileSync(new URL('categories.json', root), 'utf8')));
export const skillsById = new Map(catalogSkills.map((skill) => [skill.id, skill]));
export const skillsByDatabaseId = new Map(catalogSkills.map((skill) => [skill.databaseId, skill]));
export const rolesById = new Map(catalogRoles.map((role) => [role.id, role]));
export const rolesByDatabaseId = new Map(catalogRoles.map((role) => [role.databaseId, role]));
export { orderSkills };

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[^a-z0-9]/g, '');
const skillIndex = catalogSkills.map((skill) => ({
  skill,
  keys: [skill.name, ...skill.aliases].map(normalize),
}));
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const prior = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = prior;
    }
  }
  return row[b.length]!;
}
export function searchCatalogSkills(query: string, category?: string, limit = 100) {
  const key = normalize(query);
  return skillIndex
    .filter(
      ({ skill }) => !category || skill.category === category || skill.domains.includes(category),
    )
    .map(({ skill, keys }) => ({
      skill,
      score: !key
        ? 1
        : Math.max(
            ...keys.map((candidate) =>
              candidate === key
                ? 100
                : candidate.startsWith(key)
                  ? 80
                  : candidate.includes(key)
                    ? 60
                    : key.length >= 3 &&
                        Math.abs(candidate.length - key.length) <= 2 &&
                        distance(candidate, key) <= (key.length > 5 ? 2 : 1)
                      ? 30
                      : 0,
            ),
          ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
    .slice(0, limit)
    .map(({ skill }) => skill);
}
