import { describe, expect, it } from 'vitest';
import { orderSkills, validateCatalog } from '../src/catalog/catalog.validation.js';
import type { CatalogSkill } from '../src/catalog/catalog.schemas.js';

const skill = (id: string, prerequisites: string[] = []): CatalogSkill => ({
  id,
  databaseId: `00000000-0000-4000-8000-${id === 'a' ? '000000000001' : '000000000002'}`,
  name: id,
  aliases: [],
  category: 'testing',
  domains: ['testing'],
  type: 'concept',
  level: 'beginner',
  prerequisites,
  related: [],
  estimatedHours: 8,
  demand: 'medium',
  trending: false,
  description: 'A skill used to exercise catalog validation.',
  resources: [{ title: 'MDN', url: 'https://developer.mozilla.org/', type: 'docs', free: true }],
});
describe('catalog graph validation', () => {
  it('expands prerequisites before their dependent and deduplicates shared prerequisites', () => {
    const skills = new Map([
      ['a', skill('a')],
      ['b', skill('b', ['a'])],
    ]);
    expect(orderSkills(['b', 'a'], skills)).toEqual(['a', 'b']);
  });
  it('rejects missing prerequisite references and circular dependencies', () => {
    expect(() => orderSkills(['b'], new Map([['b', skill('b', ['a'])]]))).toThrow('Missing skill');
    expect(() =>
      orderSkills(
        ['a'],
        new Map([
          ['a', skill('a', ['b'])],
          ['b', skill('b', ['a'])],
        ]),
      ),
    ).toThrow('Circular');
  });
  it('rejects duplicate IDs and requires the requested catalog size for release', () => {
    expect(() => validateCatalog([skill('a'), skill('a')], [], false)).toThrow('Duplicate');
    expect(() => validateCatalog([skill('a')], [])).toThrow('1,500');
  });
});
