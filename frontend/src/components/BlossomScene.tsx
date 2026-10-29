import { useEffect, useRef, useState } from 'react';
const base = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/';
const blossomPoster = base + 'hf_20261021_093215_b7826239-e451-4e15-b42b-d6bcf9497a32.png';
export function BlossomScene() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      if (preference.matches) video.current?.pause();
      else void video.current?.play().catch(() => {});
    };
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  return (
    <>
      <div className="blossom-scene" aria-hidden="true">
        <video
          ref={video}
          muted
          loop
          playsInline
          preload="none"
          poster={blossomPoster}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          src={base + 'hf_20261021_093331_5998f443-1b9c-4b62-820c-8219c73c72c4.mp4'}
        />
        <img
          className="blossom-cloud cloud-left"
          alt=""
          src={base + 'hf_20261021_093216_44218665-b15e-4566-a2d4-2676ab03609d.png'}
        />
        <img
          className="blossom-cloud cloud-right"
          alt=""
          src={base + 'hf_20261021_093215_0f37c0c3-f82c-485b-87dd-5a35b75a8782.png'}
        />
        <div className="blossom-glass">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} />
          ))}
        </div>
      </div>
      <button
        className="scene-toggle"
        onClick={() => {
          if (playing) video.current?.pause();
          else void video.current?.play().catch(() => {});
        }}
      >
        {playing ? 'Pause scenery' : 'Play scenery'}
      </button>
    </>
  );
}
