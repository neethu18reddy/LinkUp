import { describe, expect, it } from 'vitest';
import {
  localDate,
  splitInterval,
  watchCredit,
  streaks,
} from '../src/modules/studio/studio.time.js';
describe('Studio time accounting', () => {
  it('splits a watch interval across local midnight without losing seconds', () => {
    const parts = splitInterval(
      new Date('2026-11-01T18:29:50Z'),
      new Date('2026-11-01T18:30:10Z'),
      'Asia/Kolkata',
    );
    expect(parts.map((part) => [part.localDate, part.seconds])).toEqual([
      ['2026-11-01', 10],
      ['2026-11-02', 10],
    ]);
  });
  it('handles a daylight-saving transition as a local calendar day', () => {
    const parts = splitInterval(
      new Date('2026-11-01T04:00:00Z'),
      new Date('2026-11-02T05:00:00Z'),
      'America/New_York',
    );
    expect(parts).toHaveLength(1);
    expect(parts[0]!.seconds).toBe(25 * 3600);
    expect(localDate(new Date('2026-11-02T00:30:00Z'), 'America/New_York')).toBe('2026-11-01');
  });
  it('caps client claims to elapsed wall time and ignores backwards counters', () => {
    const previous = { wallSec: 10, contentSec: 20, lastAt: new Date('2026-11-01T00:00:00Z') };
    expect(
      watchCredit(previous, { wallSec: 1000, contentSec: 99999 }, new Date('2026-11-01T00:00:10Z')),
    ).toEqual({ wall: 10, content: 30 });
    expect(
      watchCredit(previous, { wallSec: 5, contentSec: 3 }, new Date('2026-11-01T00:00:10Z')),
    ).toEqual({ wall: 0, content: 0 });
  });
  it('retains yesterday’s streak until today ends', () => {
    expect(streaks(['2026-10-30', '2026-10-31', '2026-11-01'], '2026-11-02')).toEqual({
      current: 3,
      longest: 3,
    });
  });
});
