import { createHash } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { studioDb, studioTransaction } from '../studio/studio.db.js';
import { localDate } from '../studio/studio.time.js';
import { isoDuration } from '../studio/studio.providers.js';
import { discoverySchema } from './youtube.schemas.js';
const ttl = 6 * 3600000;
const count = z.string().regex(/^\d+$/).max(30).optional();
export const recommendationSchema = z.object({
  id: z.string().regex(/^[\w-]{11}$/),
  title: z.string(),
  channel: z.string(),
  url: z.string(),
  thumbnailUrl: z.string().nullable(),
  publishedAt: z.string(),
  durationSec: z.number(),
  views: count.nullable(),
  likes: count.nullable(),
  comments: count.nullable(),
  language: z.string().nullable(),
  languageVerified: z.boolean(),
});
const recommendationsSchema = z.object({
  videos: z.array(recommendationSchema),
  cached: z.boolean(),
  fetchedAt: z.string(),
});
const commentsSchema = z.object({
  comments: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      author: z.string(),
      likes: z.number(),
      url: z.string(),
    }),
  ),
  unavailable: z.boolean(),
  cached: z.boolean(),
});
function configured() {
  if (!env.YOUTUBE_API_KEY?.trim())
    throw new AppError(
      503,
      'YOUTUBE_NOT_CONFIGURED',
      'YouTube discovery is not configured. You can still paste a video link into Learning Studio.',
    );
}
async function cached<T>(key: string, schema: z.ZodType<T>) {
  const row = await studioDb().studioPlaylistCache.findUnique({ where: { externalId: key } });
  if (row && row.expiresAt.getTime() > Date.now()) {
    const parsed = schema.safeParse(row.payload);
    if (parsed.success) return parsed.data;
  }
  return null;
}
async function cache(key: string, payload: unknown) {
  await studioDb().studioPlaylistCache.upsert({
    where: { externalId: key },
    create: {
      externalId: key,
      payload: JSON.parse(JSON.stringify(payload)),
      expiresAt: new Date(Date.now() + ttl),
    },
    update: { payload: JSON.parse(JSON.stringify(payload)), expiresAt: new Date(Date.now() + ttl) },
  });
}
export async function reserveSearchBudget(
  userId: string,
  upstreamCalls: number,
  now = new Date(),
  userRequest = true,
) {
  await studioTransaction(async (tx) => {
    const buckets = [
      ...(userRequest
        ? [
            { key: `user:${userId}:${localDate(now, 'UTC')}`, limit: 10, amount: 1 },
            { key: `minute:${userId}:${now.toISOString().slice(0, 16)}`, limit: 3, amount: 1 },
          ]
        : []),
      ...(upstreamCalls
        ? [
            {
              key: `project:${localDate(now, 'America/Los_Angeles')}`,
              limit: 80,
              amount: upstreamCalls,
            },
          ]
        : []),
    ];
    for (const bucket of buckets) {
      const row = await tx.youTubeSearchBudget.upsert({
        where: { key: bucket.key },
        create: { key: bucket.key, count: 0, expiresAt: new Date(now.getTime() + 3 * 86400000) },
        update: {},
      });
      if (row.count + bucket.amount > bucket.limit)
        throw new AppError(
          429,
          'YOUTUBE_SEARCH_LIMIT',
          bucket.key.startsWith('project:')
            ? 'Today’s YouTube search allowance is used. Try tomorrow or bring a favorite link.'
            : bucket.key.startsWith('minute:')
              ? 'Please wait a minute before searching again.'
              : 'You have used today’s ten video searches. Try tomorrow or bring a favorite link.',
        );
      await tx.youTubeSearchBudget.update({
        where: { key: bucket.key },
        data: { count: { increment: bucket.amount } },
      });
    }
    await tx.youTubeSearchBudget.deleteMany({ where: { expiresAt: { lt: now } } });
  });
}
export async function youtubeGet(
  endpoint: 'search' | 'videos' | 'commentThreads',
  params: Record<string, string>,
) {
  configured();
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [k, v] of Object.entries({ ...params, key: env.YOUTUBE_API_KEY! }))
    url.searchParams.set(k, v);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const reason = body?.error?.errors?.[0]?.reason;
      if (
        endpoint === 'commentThreads' &&
        (reason === 'commentsDisabled' || response.status === 404)
      )
        return { items: [], unavailable: true };
      if (
        response.status === 429 ||
        ['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded'].includes(reason)
      )
        throw new AppError(
          429,
          'YOUTUBE_QUOTA',
          'YouTube’s quota is currently unavailable. Try later or use a favorite link.',
        );
      throw new AppError(
        503,
        'YOUTUBE_UNAVAILABLE',
        'YouTube could not complete this request. Check the server API configuration or try again later.',
      );
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      'YOUTUBE_UNAVAILABLE',
      'YouTube did not respond in time. Please try again.',
    );
  }
}
const searchResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.object({
          videoId: z
            .string()
            .regex(/^[\w-]{11}$/)
            .optional(),
        }),
      }),
    )
    .default([]),
});
const metadataResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({
          title: z.string(),
          channelTitle: z.string(),
          publishedAt: z.string(),
          liveBroadcastContent: z.string().optional(),
          defaultAudioLanguage: z.string().optional(),
          defaultLanguage: z.string().optional(),
          thumbnails: z.object({ medium: z.object({ url: z.string() }).optional() }).optional(),
        }),
        contentDetails: z.object({ duration: z.string() }),
        status: z.object({
          embeddable: z.boolean().optional(),
          privacyStatus: z.string().optional(),
          uploadStatus: z.string().optional(),
        }),
        statistics: z
          .object({ viewCount: count, likeCount: count, commentCount: count })
          .optional(),
      }),
    )
    .default([]),
});
export async function discoverVideos(userId: string, input: z.infer<typeof discoverySchema>) {
  configured();
  const query = { ...input, topic: input.topic.replace(/\s+/g, ' ').trim().toLowerCase() };
  const key = `yt-discovery:v1:${createHash('sha256').update(JSON.stringify(query)).digest('hex')}`;
  const hit = await cached(key, recommendationsSchema);
  if (hit) {
    await reserveSearchBudget(userId, 0);
    return { ...hit, cached: true };
  }
  const languages = input.language === 'both' ? ['en', 'hi'] : [input.language];
  await reserveSearchBudget(userId, languages.length);
  const searches = await Promise.all(
    languages.map(async (language) =>
      searchResponse
        .parse(
          await youtubeGet('search', {
            part: 'snippet',
            type: 'video',
            q: `${query.topic} ${input.level} tutorial ${language === 'hi' ? 'हिंदी' : 'English'}`,
            relevanceLanguage: language,
            order: input.order,
            maxResults: '15',
            videoEmbeddable: 'true',
            videoSyndicated: 'true',
            safeSearch: 'strict',
          }),
        )
        .items.flatMap((row) => (row.id.videoId ? [row.id.videoId] : [])),
    ),
  );
  const ids = [...new Set(searches.flat())];
  const metadata = ids.length
    ? metadataResponse.parse(
        await youtubeGet('videos', {
          part: 'snippet,contentDetails,status,statistics',
          id: ids.join(','),
        }),
      ).items
    : [];
  const rows = new Map(
    metadata
      .filter(
        (v) =>
          v.status.embeddable === true &&
          v.status.privacyStatus === 'public' &&
          (!v.status.uploadStatus || v.status.uploadStatus === 'processed') &&
          (!v.snippet.liveBroadcastContent || v.snippet.liveBroadcastContent === 'none') &&
          isoDuration(v.contentDetails.duration) > 0,
      )
      .map((v) => [v.id, v]),
  );
  const ordered: string[] = [];
  for (let i = 0; i < 15; i++)
    for (const list of searches) {
      const id = list[i];
      if (id && rows.has(id) && !ordered.includes(id)) ordered.push(id);
    }
  const videos = ordered.slice(0, 6).map((id) => {
    const v = rows.get(id)!,
      language = v.snippet.defaultAudioLanguage ?? v.snippet.defaultLanguage ?? null;
    const thumb = v.snippet.thumbnails?.medium?.url;
    return {
      id,
      title: v.snippet.title.slice(0, 300),
      channel: v.snippet.channelTitle.slice(0, 200),
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: thumb?.startsWith('https://i.ytimg.com/') ? thumb : null,
      publishedAt: v.snippet.publishedAt,
      durationSec: isoDuration(v.contentDetails.duration),
      views: v.statistics?.viewCount ?? null,
      likes: v.statistics?.likeCount ?? null,
      comments: v.statistics?.commentCount ?? null,
      language,
      languageVerified: !!v.snippet.defaultAudioLanguage,
    };
  });
  const result = { videos, cached: false, fetchedAt: new Date().toISOString() };
  await cache(key, result);
  return result;
}
export async function videoComments(id: string) {
  configured();
  const key = `yt-comments:v1:${id}`,
    hit = await cached(key, commentsSchema);
  if (hit) return { ...hit, cached: true };
  const data = z
    .object({
      unavailable: z.boolean().optional(),
      items: z
        .array(
          z.object({
            id: z.string(),
            snippet: z.object({
              topLevelComment: z.object({
                id: z.string(),
                snippet: z.object({
                  textDisplay: z.string(),
                  authorDisplayName: z.string(),
                  likeCount: z.number().default(0),
                }),
              }),
            }),
          }),
        )
        .default([]),
    })
    .parse(
      await youtubeGet('commentThreads', {
        part: 'snippet',
        videoId: id,
        order: 'relevance',
        maxResults: '3',
        textFormat: 'plainText',
      }),
    );
  const result = {
    comments: data.items.map((row) => {
      const c = row.snippet.topLevelComment;
      return {
        id: c.id,
        text: c.snippet.textDisplay.slice(0, 3000),
        author: c.snippet.authorDisplayName.slice(0, 200),
        likes: c.snippet.likeCount,
        url: `https://www.youtube.com/watch?v=${id}${/^[\w-]{1,200}$/.test(c.id) ? `&lc=${c.id}` : ''}`,
      };
    }),
    unavailable: data.unavailable ?? false,
    cached: false,
  };
  await cache(key, result);
  return result;
}
