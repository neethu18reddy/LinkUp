import type { CatalogSkill, CatalogRole } from './catalog.schemas.js';

export function orderSkills(ids: string[], skills: Map<string, CatalogSkill>) {
  const result: string[] = [],
    visited = new Set<string>(),
    active = new Set<string>();
  function visit(id: string) {
    if (active.has(id)) throw new Error(`Circular prerequisite: ${[...active, id].join(' -> ')}`);
    if (visited.has(id)) return;
    const skill = skills.get(id);
    if (!skill) throw new Error(`Missing skill: ${id}`);
    active.add(id);
    for (const prerequisite of skill.prerequisites) visit(prerequisite);
    active.delete(id);
    visited.add(id);
    result.push(id);
  }
  ids.forEach(visit);
  return result;
}

export function validateCatalog(
  skills: CatalogSkill[],
  roles: CatalogRole[],
  requireCounts = true,
) {
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
  };
  unique(
    skills.map((skill) => skill.id),
    'skill ID',
  );
  unique(
    skills.map((skill) => skill.databaseId),
    'skill UUID',
  );
  unique(
    skills.map((skill) => skill.name.toLowerCase().replace(/[^a-z0-9+#]/g, '')),
    'skill name',
  );
  unique(
    roles.map((role) => role.id),
    'role ID',
  );
  unique(
    roles.map((role) => role.databaseId),
    'role UUID',
  );
  const skillMap = new Map(skills.map((skill) => [skill.id, skill]));
  const roleIds = new Set(roles.map((role) => role.id)),
    used = new Set<string>();
  orderSkills([...skillMap.keys()], skillMap);
  for (const skill of skills)
    for (const related of skill.related)
      if (!skillMap.has(related)) throw new Error(`Unknown related skill: ${related}`);
  for (const role of roles) {
    unique(
      role.skills.map((skill) => skill.skillId),
      `requirement in ${role.id}`,
    );
    for (const skill of role.skills) {
      if (!skillMap.has(skill.skillId)) throw new Error(`${role.id}: missing ${skill.skillId}`);
      used.add(skill.skillId);
    }
    for (const related of [...role.relatedRoles, ...role.careerPath.from, ...role.careerPath.to])
      if (!roleIds.has(related)) throw new Error(`Unknown related role: ${related}`);
  }
  if (requireCounts) {
    if (skills.length < 1500 || roles.length < 300)
      throw new Error('Need at least 1,500 skills and 300 roles');
    const unused = skills.filter((skill) => !used.has(skill.id));
    if (unused.length)
      throw new Error(`Unreferenced skills: ${unused.map((skill) => skill.id).join(', ')}`);
  }
  return { skills: skills.length, roles: roles.length };
}
