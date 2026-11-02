import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sectionItems, suggestSkills } from '../src/modules/studio/studio.sectioning.js';
import { youtubeInput, isoDuration } from '../src/modules/studio/studio.providers.js';
import { validateSections } from '../src/modules/studio/studio.resources.js';
import { skillsByDatabaseId } from '../src/catalog/catalog.js';
describe('Studio imports and chapter suggestions', () => {
  it('parses official playlist, video and pasted-video URLs while rejecting other hosts', () => {
    expect(youtubeInput('https://www.youtube.com/playlist?list=PL1234567890').playlist).toBe(
      'PL1234567890',
    );
    expect(
      youtubeInput('https://youtu.be/dQw4w9WgXcQ\nhttps://www.youtube.com/watch?v=9bZkp7q19f0')
        .videos,
    ).toHaveLength(2);
    expect(() => youtubeInput('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ')).toThrow();
    expect(() => youtubeInput('https://example.test/private-network')).toThrow();
    expect(isoDuration('PT1H2M3S')).toBe(3723);
  });
  it('uses chapter boundaries and bounded chunks without losing or duplicating items', () => {
    const items = Array.from({ length: 19 }, (_, index) => ({
      key: randomUUID(),
      title: `${index < 3 ? 'Module 1' : 'Module 2'} JavaScript lesson ${index + 1}`,
      durationSec: 1000,
      externalVideoId: null,
      url: null,
      thumbnailUrl: null,
      available: true,
    }));
    const sections = sectionItems(items);
    expect(sections[0]!.itemKeys).toHaveLength(3);
    expect(sections.every((section) => section.itemKeys.length <= 8)).toBe(true);
    expect(sections.flatMap((section) => section.itemKeys)).toEqual(items.map((item) => item.key));
    expect(() =>
      validateSections(
        sections,
        items.map((item) => item.key),
      ),
    ).not.toThrow();
    expect(() =>
      validateSections(
        [{ ...sections[0]!, itemKeys: [items[0]!.key, items[0]!.key] }],
        items.map((item) => item.key),
      ),
    ).toThrow();
    expect(
      suggestSkills('JS arrays and React components').some(
        (skill) => skillsByDatabaseId.get(skill.skillId)?.name === 'JavaScript',
      ),
    ).toBe(true);
  });
});
