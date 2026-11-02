import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { providers } from '../src/modules/studio/studio.providers.js';
const cached = vi.hoisted(() => new Map<string, { payload: unknown; expiresAt: Date }>());
vi.mock('../src/modules/studio/studio.db.js', () => ({
  studioDb: () => ({
    studioPlaylistCache: {
      findUnique: async ({ where }: { where: { externalId: string } }) =>
        cached.get(where.externalId) ?? null,
      upsert: async ({
        create,
      }: {
        create: { externalId: string; payload: unknown; expiresAt: Date };
      }) => {
        cached.set(create.externalId, create);
        return create;
      },
    },
  }),
}));
const original = env.YOUTUBE_API_KEY;
beforeEach(() => {
  cached.clear();
  env.YOUTUBE_API_KEY = 'test-only-youtube-key';
});
afterEach(() => {
  env.YOUTUBE_API_KEY = original;
  vi.unstubAllGlobals();
});
describe('official YouTube provider', () => {
  it('paginates playlist items, batch-fetches metadata, retains unavailable items and caches previews', async () => {
    const fetcher = vi.fn(async (input: URL) => {
      expect(input.hostname).toBe('www.googleapis.com');
      const route = input.pathname.split('/').at(-1);
      if (route === 'playlists')
        return Response.json({
          items: [
            {
              id: 'PL1234567890',
              snippet: { title: 'JavaScript course', channelTitle: 'Publisher' },
            },
          ],
        });
      if (route === 'playlistItems')
        return Response.json(
          input.searchParams.has('pageToken')
            ? {
                items: [
                  {
                    id: 'entry-2',
                    snippet: { title: 'Unavailable lesson' },
                    contentDetails: { videoId: '9bZkp7q19f0' },
                  },
                  { id: 'entry-3', snippet: { title: 'Deleted video' } },
                ],
              }
            : {
                nextPageToken: 'NEXT',
                items: [
                  {
                    id: 'entry-1',
                    snippet: { title: 'Lesson 1' },
                    contentDetails: { videoId: 'dQw4w9WgXcQ' },
                  },
                ],
              },
        );
      return Response.json({
        items: [
          {
            id: 'dQw4w9WgXcQ',
            snippet: { title: 'JavaScript arrays', channelTitle: 'Publisher' },
            contentDetails: { duration: 'PT11M' },
            status: { embeddable: true, privacyStatus: 'public' },
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const input = {
      provider: 'youtube' as const,
      input: 'https://www.youtube.com/playlist?list=PL1234567890',
      title: 'My course',
      items: [],
    };
    const preview = await providers.youtube.preview(input);
    expect(preview.items).toHaveLength(3);
    expect(preview.items.filter((item) => item.available)).toHaveLength(1);
    expect(preview.items[0]!.durationSec).toBe(660);
    expect(preview.items[2]!.externalVideoId).toBeNull();
    const calls = fetcher.mock.calls.length;
    const next = await providers.youtube.preview(input);
    expect(fetcher).toHaveBeenCalledTimes(calls);
    expect(next.items[0]!.key).not.toBe(preview.items[0]!.key);
  });
  it('offers a manual path without a key and explains quota failures', async () => {
    env.YOUTUBE_API_KEY = undefined;
    await expect(
      providers.youtube.preview({
        provider: 'youtube',
        input: 'https://www.youtube.com/playlist?list=PL1234567890',
        title: 'Course',
        items: [],
      }),
    ).rejects.toMatchObject({ code: 'YOUTUBE_NOT_CONFIGURED' });
    const manual = await providers.youtube.preview({
      provider: 'youtube',
      input: 'https://youtu.be/dQw4w9WgXcQ',
      title: 'Video',
      items: [],
    });
    expect(manual.items[0]).toMatchObject({ durationSec: 0, available: true });
    env.YOUTUBE_API_KEY = 'test-only-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 403 })),
    );
    await expect(
      providers.youtube.preview({
        provider: 'youtube',
        input: 'https://www.youtube.com/playlist?list=PL9876543210',
        title: 'Course',
        items: [],
      }),
    ).rejects.toMatchObject({ code: 'YOUTUBE_QUOTA' });
  });
});
