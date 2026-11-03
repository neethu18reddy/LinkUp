import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { requestError } from '@/lib/http';
import { duration } from '@/features/studio/studio.api';
import {
  findVideos,
  getVideoComments,
  getYouTubePreference,
  youtubeKeys,
  type VideoLanguage,
  type RecommendedVideo,
} from './youtube.api';
import './youtube.css';
const metric = (v: string | null) =>
  v === null
    ? 'Not provided'
    : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
        Number(v),
      );
function VideoCard({
  video,
  topic,
  language,
  level,
}: {
  video: RecommendedVideo;
  topic: string;
  language: VideoLanguage;
  level: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const comments = useQuery({
    queryKey: ['youtube-comments', video.id],
    queryFn: () => getVideoComments(video.id),
    enabled: expanded,
    staleTime: 6 * 3600000,
    retry: false,
  });
  const params = new URLSearchParams({ url: video.url, topic, language, level });
  return (
    <article className="youtube-video-card">
      {video.thumbnailUrl && (
        <img src={video.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
      )}
      <h3>
        <a href={video.url} target="_blank" rel="noopener noreferrer">
          {video.title}
        </a>
      </h3>
      <p>
        {video.channel} · {duration(video.durationSec)} · {video.publishedAt.slice(0, 10)}
      </p>
      <p className="field-hint">
        {video.languageVerified
          ? `Audio language: ${video.language}`
          : 'Audio language not verified; search preference applied.'}
      </p>
      <dl className="youtube-metrics">
        <div>
          <dt>Views</dt>
          <dd>{metric(video.views)}</dd>
        </div>
        <div>
          <dt>Likes</dt>
          <dd>{metric(video.likes)}</dd>
        </div>
        <div>
          <dt>Comments</dt>
          <dd>{metric(video.comments)}</dd>
        </div>
      </dl>
      <div className="youtube-actions">
        <a
          className="button button-outline"
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Watch on YouTube
        </a>
        <Link className="button button-glow" to={`/youtube?${params}`}>
          Build my study plan
        </Link>
      </div>
      <Button variant="outline" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Hide top comments' : 'Show top comments'}
      </Button>
      {expanded && (
        <div className="youtube-comments" aria-live="polite">
          {comments.isPending ? (
            <p>Loading top comments…</p>
          ) : comments.isError ? (
            <p role="alert">{requestError(comments.error)}</p>
          ) : comments.data?.comments.length ? (
            comments.data.comments.map((c) => (
              <blockquote key={c.id}>
                <p>{c.text}</p>
                <footer>
                  {c.author} · {c.likes} likes ·{' '}
                  <a href={c.url} target="_blank" rel="noopener noreferrer">
                    View comment
                  </a>
                </footer>
              </blockquote>
            ))
          ) : (
            <p>
              {comments.data?.unavailable
                ? 'Comments are unavailable for this video.'
                : 'No public comments were returned.'}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
export function VideoFinder({
  initialTopic = '',
  initialLanguage = '',
  initialLevel = 'beginner',
}: {
  initialTopic?: string;
  initialLanguage?: VideoLanguage | '';
  initialLevel?: 'beginner' | 'intermediate' | 'advanced';
}) {
  const id = useId(),
    client = useQueryClient();
  const preference = useQuery({
    queryKey: youtubeKeys.preferences,
    queryFn: getYouTubePreference,
    retry: false,
  });
  const [topic, setTopic] = useState<string | null>(null),
    [choice, setChoice] = useState<VideoLanguage | ''>(initialLanguage),
    [level, setLevel] = useState(initialLevel),
    [order, setOrder] = useState<'relevance' | 'viewCount' | 'rating'>('relevance');
  const language = choice || preference.data?.language || '',
    value = topic ?? initialTopic.slice(0, 120);
  const savePreference = useMutation({
    mutationFn: async (language: VideoLanguage) => {
      await api.put('/youtube/preferences', { language });
      return { language };
    },
    onSuccess: (data) => client.setQueryData(youtubeKeys.preferences, data),
  });
  const search = useMutation({ mutationFn: findVideos });
  return (
    <section className="youtube-finder" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Find videos for your topic</h2>
      <p>Choose Hindi, English or both. Search when you’re ready.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (language && value.trim().length >= 2)
            search.mutate({ topic: value.trim(), language, level, order });
        }}
      >
        <div className="form-field">
          <label htmlFor={`${id}-topic`}>Learning topic</label>
          <input
            id={`${id}-topic`}
            value={value}
            onChange={(e) => setTopic(e.target.value)}
            minLength={2}
            maxLength={120}
            required
            placeholder="e.g. JavaScript arrays"
          />
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-language`}>Preferred language</label>
          <select
            id={`${id}-language`}
            required
            value={language}
            onChange={(e) => {
              const v = e.target.value as VideoLanguage;
              setChoice(v);
              savePreference.mutate(v);
            }}
          >
            <option value="" disabled>
              Choose Hindi or English
            </option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="both">Hindi and English</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-level`}>Your level</label>
          <select
            id={`${id}-level`}
            value={level}
            onChange={(e) => setLevel(e.target.value as typeof level)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-order`}>Sort videos</label>
          <select
            id={`${id}-order`}
            value={order}
            onChange={(e) => setOrder(e.target.value as typeof order)}
          >
            <option value="relevance">Best topic match</option>
            <option value="viewCount">Most viewed</option>
            <option value="rating">Highest rated on YouTube</option>
          </select>
        </div>
        <Button type="submit" disabled={!language || value.trim().length < 2 || search.isPending}>
          {search.isPending ? 'Finding videos…' : 'Find videos'}
        </Button>
      </form>
      {savePreference.isError && (
        <p role="status">Language applies to this search; it could not be saved to your account.</p>
      )}
      {search.isError && <p role="alert">{requestError(search.error)}</p>}
      {search.data && (
        <>
          <p role="status">
            {search.data.videos.length} videos for “{search.variables?.topic}” ·{' '}
            {search.data.cached ? 'cached YouTube results' : 'YouTube results'} · checked{' '}
            {search.data.fetchedAt.slice(0, 16).replace('T', ' ')} UTC
          </p>
          <p className="field-hint">
            Views, likes and comments are public signals, not a guarantee of teaching quality.
            Impressions are private creator analytics.
          </p>
          <div className="youtube-results">
            {search.data.videos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                topic={search.variables!.topic}
                language={search.variables!.language}
                level={search.variables!.level}
              />
            ))}
          </div>
          {!search.data.videos.length && <p>Try a more specific topic or another language.</p>}
        </>
      )}
      <p>
        <Link to="/youtube">Bring a favorite video or playlist →</Link>
      </p>
    </section>
  );
}
