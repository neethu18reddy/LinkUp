import { randomUUID, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { studioDb } from './studio.db.js';
import { importSchema, previewItemSchema, type PreviewItem } from './studio.schemas.js';
import { sectionItems } from './studio.sectioning.js';
import { skillsByDatabaseId } from '../../catalog/catalog.js';

const previewSchema = z.object({
  provider: z.enum(['youtube', 'custom']),
  externalId: z.string().nullable(),
  title: z.string(),
  channel: z.string(),
  items: z.array(previewItemSchema).max(2000),
  userId: z.uuid(),
  expiresAt: z.number(),
});
const key = env.JWT_ACCESS_SECRET ?? randomBytes(32).toString('hex');
const sign = (data: string) =>
  createHmac('sha256', key).update(`studio-preview:${data}`).digest('base64url');
export function readPreview(token: string, userId: string) {
  const [payload = '', signature = ''] = token.split('.');
  const expected = Buffer.from(sign(payload)),
    received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received))
    throw new AppError(422, 'PREVIEW_INVALID', 'Preview expired or changed. Import again.');
  const parsed = previewSchema.safeParse(JSON.parse(Buffer.from(payload, 'base64url').toString()));
  if (!parsed.success || parsed.data.userId !== userId || parsed.data.expiresAt < Date.now())
    throw new AppError(422, 'PREVIEW_INVALID', 'Preview expired or changed. Import again.');
  return parsed.data;
}
export function youtubeInput(input: string) {
  const urls = input
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!urls.length || urls.length > 500)
    throw new AppError(422, 'IMPORT_INVALID', 'Paste a YouTube playlist or up to 500 video links.');
  const parsed = urls.map((value) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new AppError(422, 'IMPORT_INVALID', 'Use complete YouTube URLs.');
    }
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)
    )
      throw new AppError(422, 'IMPORT_INVALID', 'Use a YouTube playlist or video link.');
    const playlist = url.searchParams.get('list');
    if (playlist && /^[\w-]{10,100}$/.test(playlist) && urls.length === 1) return { playlist };
    const video =
      url.hostname === 'youtu.be'
        ? url.pathname.slice(1)
        : (url.searchParams.get('v') ?? /^\/(?:shorts|embed)\/([\w-]+)$/.exec(url.pathname)?.[1]);
    if (!video || !/^[\w-]{11}$/.test(video))
      throw new AppError(
        422,
        'IMPORT_INVALID',
        'A playlist cannot be mixed with other links. Paste video URLs or one playlist.',
      );
    return { video };
  });
  return {
    playlist: parsed[0]?.playlist,
    videos: parsed.flatMap((row) => (row.video ? [row.video] : [])),
  };
}
export function isoDuration(value: string) {
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value);
  return match
    ? Math.round(
        Number(match[1] ?? 0) * 86400 +
          Number(match[2] ?? 0) * 3600 +
          Number(match[3] ?? 0) * 60 +
          Number(match[4] ?? 0),
      )
    : 0;
}
const snippet = z.object({
  title: z.string().default('Unavailable video'),
  channelTitle: z.string().default(''),
  resourceId: z.object({ videoId: z.string() }).optional(),
  thumbnails: z.record(z.string(), z.object({ url: z.string() })).optional(),
});
const apiSchema = z.object({
  nextPageToken: z.string().optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: snippet.optional(),
        contentDetails: z
          .object({ duration: z.string().optional(), videoId: z.string().optional() })
          .optional(),
        status: z
          .object({ embeddable: z.boolean().optional(), privacyStatus: z.string().optional() })
          .optional(),
      }),
    )
    .default([]),
});
async function youtubeApi(route: string, parameters: Record<string, string>, deadline: number) {
  if (Date.now() >= deadline)
    throw new AppError(
      503,
      'YOUTUBE_TIMEOUT',
      'This import took too long. Try a smaller playlist or retry shortly.',
    );
  const url = new URL(`https://www.googleapis.com/youtube/v3/${route}`);
  url.search = new URLSearchParams({ ...parameters, key: env.YOUTUBE_API_KEY! }).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(Math.max(1, Math.min(10000, deadline - Date.now()))),
      redirect: 'error',
    });
  } catch {
    throw new AppError(
      503,
      'YOUTUBE_UNAVAILABLE',
      'YouTube could not be reached. Try again or paste video links manually.',
    );
  }
  if (!response.ok) {
    if (response.status === 403 || response.status === 429)
      throw new AppError(
        429,
        'YOUTUBE_QUOTA',
        'YouTube quota or API access is unavailable. Try later or use manual video links.',
      );
    throw new AppError(
      422,
      'YOUTUBE_IMPORT_FAILED',
      'This playlist may be private, deleted or unavailable. Check the link.',
    );
  }
  return apiSchema.parse(await response.json());
}
export interface ResourceProvider {
  preview(input: z.infer<typeof importSchema>): Promise<{
    provider: 'youtube' | 'custom';
    externalId: string | null;
    title: string;
    channel: string;
    items: PreviewItem[];
    notice?: string;
  }>;
}
export const providers: Record<'youtube' | 'custom', ResourceProvider> = {
  custom: {
    async preview(input) {
      if (!input.items.length)
        throw new AppError(422, 'IMPORT_EMPTY', 'Add at least one custom learning item.');
      return {
        provider: 'custom',
        externalId: null,
        title: input.title,
        channel: 'Your custom learning plan',
        items: input.items.map((item) => ({
          key: randomUUID(),
          title: item.title,
          url: item.url ?? null,
          durationSec: item.durationSec,
          externalVideoId: null,
          thumbnailUrl: null,
          available: true,
        })),
      };
    },
  },
  youtube: {
    async preview(input) {
      const deadline = Date.now() + 35000;
      const parsed = youtubeInput(input.input);
      const cacheId = parsed.playlist
        ? `playlist:${parsed.playlist}`
        : `videos:${parsed.videos.join(',')}`;
      if (cacheId.length <= 200 && env.YOUTUBE_API_KEY) {
        const cached = await studioDb().studioPlaylistCache.findUnique({
          where: { externalId: cacheId },
        });
        if (cached && cached.expiresAt > new Date()) {
          const data = z
            .object({ title: z.string(), channel: z.string(), items: z.array(previewItemSchema) })
            .parse(cached.payload);
          return {
            ...data,
            provider: 'youtube',
            externalId: parsed.playlist ?? null,
            items: data.items.map((item) => ({ ...item, key: randomUUID() })),
          };
        }
      }
      if (!env.YOUTUBE_API_KEY && parsed.playlist)
        throw new AppError(
          503,
          'YOUTUBE_NOT_CONFIGURED',
          'Playlist import needs a server YouTube API key. You can still paste individual video URLs or make a custom checklist.',
        );
      let ids = parsed.videos,
        title = input.title,
        channel = 'YouTube',
        pageToken: string | undefined;
      const unavailable = new Map<string, string>();
      if (parsed.playlist) {
        ids = [];
        const metadata = await youtubeApi(
          'playlists',
          { part: 'snippet', id: parsed.playlist },
          deadline,
        );
        if (!metadata.items.length)
          throw new AppError(422, 'YOUTUBE_IMPORT_FAILED', 'Playlist is private or unavailable.');
        title = metadata.items[0]?.snippet?.title ?? title;
        channel = metadata.items[0]?.snippet?.channelTitle ?? channel;
        do {
          const page = await youtubeApi(
            'playlistItems',
            {
              part: 'snippet,contentDetails',
              playlistId: parsed.playlist,
              maxResults: '50',
              ...(pageToken ? { pageToken } : {}),
            },
            deadline,
          );
          for (const row of page.items) {
            const id =
              row.contentDetails?.videoId ??
              row.snippet?.resourceId?.videoId ??
              `missing:${row.id}`;
            ids.push(id);
            unavailable.set(id, row.snippet?.title ?? 'Unavailable video');
          }
          pageToken = page.nextPageToken;
          if (ids.length > 2000)
            throw new AppError(
              422,
              'PLAYLIST_TOO_LARGE',
              'Split playlists with more than 2,000 items into smaller learning plans.',
            );
        } while (pageToken);
      }
      if (!ids.length) throw new AppError(422, 'IMPORT_EMPTY', 'This playlist has no videos.');
      const metadata = new Map<string, z.infer<typeof apiSchema>['items'][number]>();
      if (env.YOUTUBE_API_KEY)
        for (let index = 0; index < ids.length; index += 50) {
          const batch = [
            ...new Set(ids.slice(index, index + 50).filter((id) => /^[\w-]{11}$/.test(id))),
          ];
          if (!batch.length) continue;
          const page = await youtubeApi(
            'videos',
            {
              part: 'snippet,contentDetails,status',
              id: batch.join(','),
            },
            deadline,
          );
          for (const video of page.items) metadata.set(video.id, video);
        }
      const items = ids.map((id) => {
        const row = metadata.get(id);
        return {
          key: randomUUID(),
          externalVideoId: /^[\w-]{11}$/.test(id) ? id : null,
          title: (row?.snippet?.title ?? unavailable.get(id) ?? `YouTube video ${id}`).slice(
            0,
            200,
          ),
          url: /^[\w-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null,
          durationSec: isoDuration(row?.contentDetails?.duration ?? ''),
          thumbnailUrl: row?.snippet?.thumbnails?.medium?.url ?? null,
          available:
            /^[\w-]{11}$/.test(id) &&
            (!env.YOUTUBE_API_KEY ||
              (!!row &&
                row.status?.embeddable !== false &&
                row.status?.privacyStatus !== 'private')),
        };
      });
      if (!parsed.playlist && items.length === 1) {
        title = items[0]!.title;
        channel = metadata.get(ids[0]!)?.snippet?.channelTitle ?? channel;
      }
      if (cacheId.length <= 200 && env.YOUTUBE_API_KEY)
        await studioDb().studioPlaylistCache.upsert({
          where: { externalId: cacheId },
          create: {
            externalId: cacheId,
            payload: { title, channel, items },
            expiresAt: new Date(Date.now() + 15 * 60000),
          },
          update: {
            payload: { title, channel, items },
            expiresAt: new Date(Date.now() + 15 * 60000),
          },
        });
      return {
        provider: 'youtube',
        externalId: parsed.playlist ?? null,
        title: title.slice(0, 200),
        channel,
        items,
        ...(!env.YOUTUBE_API_KEY
          ? {
              notice:
                'Saved as manual video links. Metadata and automatic percentage completion need a server YouTube API key; manual completion is available.',
            }
          : {}),
      };
    },
  },
};
export async function importPreview(userId: string, input: z.infer<typeof importSchema>) {
  const preview = await providers[input.provider].preview(input);
  const payload = Buffer.from(
    JSON.stringify({ ...preview, userId, expiresAt: Date.now() + 30 * 60000 }),
  ).toString('base64url');
  const sections = sectionItems(preview.items);
  return {
    ...preview,
    sections,
    skillNames: Object.fromEntries(
      sections.flatMap((section) =>
        section.skills.map((skill) => [
          skill.skillId,
          skillsByDatabaseId.get(skill.skillId)?.name ?? 'Skill',
        ]),
      ),
    ),
    previewToken: `${payload}.${sign(payload)}`,
    youtubeConfigured: !!env.YOUTUBE_API_KEY,
  };
}
