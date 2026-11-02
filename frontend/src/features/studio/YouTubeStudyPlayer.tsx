import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { type StudioItem } from './studio.api';
interface Player {
  getCurrentTime(): number;
  getDuration(): number;
  getPlaybackRate(): number;
  getPlayerState(): number;
  seekTo(seconds: number, allow: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
}
interface PlayerAPI {
  Player: new (
    element: HTMLElement,
    config: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady(event: { target: Player }): void;
        onStateChange(event: { data: number; target: Player }): void;
        onError(event: { data: number }): void;
      };
    },
  ) => Player;
}
declare global {
  interface Window {
    YT?: PlayerAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let loading: Promise<PlayerAPI> | undefined;
function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise<PlayerAPI>((resolve, reject) => {
    const existing = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      existing?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      loading = undefined;
      reject(new Error('YouTube player could not load. Open the video on YouTube or try again.'));
    };
    document.head.append(script);
  });
  return loading;
}
const leaseSchema = z.object({
  sessionId: z.string(),
  wallSec: z.number(),
  contentSec: z.number(),
  token: z.string(),
});
export interface PlayerControls {
  position: () => number;
  seek: (seconds: number) => void;
}
export function YouTubeStudyPlayer({
  item,
  controls,
  onEnded,
  autoplay = false,
  initialPosition,
}: {
  item: StudioItem;
  controls: React.MutableRefObject<PlayerControls>;
  onEnded: () => void;
  autoplay?: boolean;
  initialPosition?: number;
}) {
  const host = useRef<HTMLDivElement>(null),
    player = useRef<Player | null>(null),
    client = useQueryClient();
  const [failure, setFailure] = useState(''),
    [watchElsewhere, setWatchElsewhere] = useState(false),
    [notice, setNotice] = useState('');
  const callbacks = useRef({ onEnded });
  useEffect(() => {
    callbacks.current = { onEnded };
  }, [onEnded]);
  const [playback] = useState(() => ({ item, autoplay, initialPosition }));
  useEffect(() => {
    const { item, autoplay, initialPosition } = playback;
    const container = host.current;
    if (!item.externalVideoId || !host.current) return;
    let disposed = false,
      sessionId = crypto.randomUUID(),
      token = '',
      active = false,
      acquiring = false,
      wallSec = 0,
      contentSec = 0,
      previousTime = performance.now(),
      previousPosition = item.progress?.lastPositionSec ?? 0,
      completed = item.progress?.status === 'completed';
    let queue = Promise.resolve();
    const refresh = () => {
      for (const key of [
        'studio-resource',
        'studio-resources',
        'studio-skills',
        'studio-overview',
        'studio-analytics',
        'current-roadmap',
        'progress-summary',
        'my-skills',
        'plan',
        'career-matches',
      ])
        void client.invalidateQueries({ queryKey: [key] });
    };
    const begin = async (takeover = false) => {
      if (acquiring) return;
      acquiring = true;
      try {
        const data = leaseSchema.parse(
          (await api.post('/progress/watch', { sessionId, itemId: item.id, takeover })).data.data,
        );
        wallSec = Math.max(wallSec, data.wallSec);
        contentSec = Math.max(contentSec, data.contentSec);
        token = data.token;
        active = true;
        previousTime = performance.now();
        previousPosition = player.current?.getCurrentTime() ?? 0;
        if (!disposed) {
          setFailure('');
          setWatchElsewhere(false);
        }
      } catch (error) {
        active = false;
        if (!disposed) {
          setFailure(requestError(error));
          setWatchElsewhere(true);
        }
      } finally {
        acquiring = false;
      }
    };
    const payload = (ended = false, release = false) => ({
      sessionId,
      requestId: crypto.randomUUID(),
      itemId: item.id,
      wallSec,
      contentSec,
      positionSec: player.current?.getCurrentTime() ?? previousPosition,
      ended,
      release,
    });
    const flush = (ended = false, release = false) => {
      if (!active) return Promise.resolve();
      const body = payload(ended, release);
      queue = queue.then(async () => {
        try {
          const data = z
            .object({ token: z.string(), progress: z.object({ status: z.string() }).nullable() })
            .parse((await api.post('/progress/heartbeat', body)).data.data);
          token = data.token;
          if (data.progress?.status === 'completed' && !completed) {
            completed = true;
            if (!disposed) setNotice('Video completed. A small win, saved.');
          }
          refresh();
        } catch (error) {
          if (!disposed) setFailure(requestError(error));
          active = false;
        }
      });
      if (release) active = false;
      return queue;
    };
    const beacon = () => {
      if (!active || !token) return;
      const body = JSON.stringify({ ...payload(false, true), token }),
        url = `${String(api.defaults.baseURL ?? '/api/v1').replace(/\/$/, '')}/progress/heartbeat/beacon`;
      if (!navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' })))
        void fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      active = false;
    };
    const visible = () => {
      if (document.hidden) beacon();
      else if (player.current?.getPlayerState() === 1) void begin();
      previousTime = performance.now();
      previousPosition = player.current?.getCurrentTime() ?? 0;
    };
    const setup = async () => {
      try {
        const yt = await loadYouTube();
        if (disposed || !host.current) return;
        const element = document.createElement('div');
        host.current.replaceChildren(element);
        player.current = new yt.Player(element, {
          videoId: item.externalVideoId!,
          width: '100%',
          height: '100%',
          playerVars: {
            origin: location.origin,
            playsinline: 1,
            autoplay: autoplay ? 1 : 0,
            rel: 0,
            start: Math.floor(initialPosition ?? item.progress?.lastPositionSec ?? 0),
          },
          events: {
            onReady: (event) => {
              player.current = event.target;
              controls.current = {
                position: () => event.target.getCurrentTime(),
                seek: (seconds) => event.target.seekTo(Math.max(0, seconds), true),
              };
            },
            onStateChange: (event) => {
              previousTime = performance.now();
              previousPosition = event.target.getCurrentTime();
              if (event.data === 1 && !active) void begin();
              if (event.data === 2) flush();
              if (event.data === 0) {
                void flush(true, true).then(() => callbacks.current.onEnded());
              }
            },
            onError: () => {
              if (!disposed)
                setFailure(
                  'This video cannot play here. Open it on YouTube or use manual completion.',
                );
            },
          },
        });
      } catch (error) {
        if (!disposed) setFailure(requestError(error));
      }
    };
    void setup();
    const sample = setInterval(() => {
      const current = player.current,
        now = performance.now();
      if (current) {
        const position = current.getCurrentTime(),
          elapsed = Math.min(2, (now - previousTime) / 1000),
          delta = position - previousPosition;
        if (
          active &&
          current.getPlayerState() === 1 &&
          !document.hidden &&
          delta >= 0 &&
          delta <= elapsed * Math.max(1, current.getPlaybackRate()) + 1.5
        ) {
          wallSec += elapsed;
          contentSec += Math.max(0, delta);
        }
        previousPosition = position;
      }
      previousTime = now;
    }, 1000);
    const heartbeat = setInterval(() => {
      if (active && !document.hidden) flush();
    }, 10000);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('pagehide', beacon);
    window.addEventListener('beforeunload', beacon);
    const takeOver = () => {
      sessionId = crypto.randomUUID();
      wallSec = 0;
      contentSec = 0;
      void begin(true);
    };
    const handler = () => takeOver();
    host.current.addEventListener('studio-takeover', handler);
    return () => {
      disposed = true;
      beacon();
      clearInterval(sample);
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('pagehide', beacon);
      window.removeEventListener('beforeunload', beacon);
      container?.removeEventListener('studio-takeover', handler);
      player.current?.destroy();
      player.current = null;
      controls.current = { position: () => item.progress?.lastPositionSec ?? 0, seek: () => {} };
    };
  }, [playback, client, controls]);
  return (
    <>
      <div className="studio-player" ref={host} />
      {notice && <p role="status">{notice}</p>}
      {failure && (
        <div role="alert">
          <p>{failure}</p>
          {watchElsewhere && (
            <Button
              variant="outline"
              onClick={() => host.current?.dispatchEvent(new Event('studio-takeover'))}
            >
              Track playback in this tab
            </Button>
          )}
        </div>
      )}
      <p className="field-hint">
        Video provided by{' '}
        <a
          href={`https://www.youtube.com/watch?v=${item.externalVideoId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          YouTube · Open original video
        </a>
        . Seeks are not credited as watched time.
      </p>
    </>
  );
}
