import { catalogSkills } from '../../catalog/catalog.js';
import type { PreviewItem, StudioSectionInput } from './studio.schemas.js';
const tokens = (value: string) =>
  value
    .toLowerCase()
    .replace(
      /\b(part|chapter|day|lecture|module|lesson|video|tutorial|course|the|and|for|with|in|of)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9+#]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 2 && !/^\d+$/.test(word));
const mappings = catalogSkills.map((skill) => ({
  skillId: skill.databaseId,
  name: skill.name,
  terms: [skill.name, ...skill.aliases]
    .filter((term) => term.length >= 2)
    .map((term) => term.toLowerCase()),
}));
export function suggestSkills(titles: string) {
  const normalized = ` ${titles.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ')} `;
  return mappings
    .flatMap((row) => {
      const term = row.terms.find((term) =>
        normalized.includes(` ${term.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ')} `),
      );
      return term
        ? [
            {
              skillId: row.skillId,
              confidence: term === row.name.toLowerCase() ? 0.9 : 0.75,
              length: term.length,
            },
          ]
        : [];
    })
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
    .map(({ skillId, confidence }) => ({ skillId, confidence }));
}
export function sectionItems(items: PreviewItem[]): StudioSectionInput[] {
  const groups: PreviewItem[][] = [];
  let module = '';
  for (const item of items) {
    const explicit =
      /\b(?:module|chapter|section|unit)\s*([\dA-Za-z]+)\b/i.exec(item.title)?.[0]?.toLowerCase() ??
      '';
    const current = groups[groups.length - 1];
    const titleTokens = new Set(tokens(item.title));
    const previousTokens = new Set(tokens(current?.at(-1)?.title ?? ''));
    const overlap = [...titleTokens].filter((term) => previousTokens.has(term)).length;
    const duration = current?.reduce((sum, row) => sum + row.durationSec, 0) ?? 0;
    if (
      !current ||
      current.length >= 8 ||
      duration >= 4500 ||
      (explicit && module && explicit !== module) ||
      (current.length >= 4 && titleTokens.size > 0 && previousTokens.size > 0 && overlap === 0)
    )
      groups.push([item]);
    else current.push(item);
    if (explicit) module = explicit;
  }
  return groups.map((rows, index) => {
    const topicTags = [...new Set(rows.flatMap((item) => tokens(item.title)))].slice(0, 3);
    return {
      title: `Chapter ${index + 1}: ${rows[0]!.title.split(/\s+/).slice(0, 5).join(' ')}`.slice(
        0,
        200,
      ),
      topicSummary: `Practice ${topicTags.join(', ') || 'the next set of lessons'}.`,
      topicTags,
      skills: suggestSkills(rows.map((row) => row.title).join(' ')),
      itemKeys: rows.map((row) => row.key),
    };
  });
}
