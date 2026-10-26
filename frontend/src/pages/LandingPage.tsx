import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUpRight, BookOpen, Check, Compass, Route, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getHealth } from '@/lib/api';
import { useAuth } from '@/store/auth';

const steps = [
  {
    icon: Compass,
    number: '01',
    title: 'Find your direction',
    detail: 'Start with what you know and where you want to go.',
  },
  {
    icon: Route,
    number: '02',
    title: 'Make a plan that fits',
    detail: 'A clear learning path, built around your available time.',
  },
  {
    icon: BookOpen,
    number: '03',
    title: 'Learn. Build. Move forward.',
    detail: 'Turn small steps into skills you can put to work.',
  },
];

function ServerStatus() {
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    retry: 1,
  });

  return (
    <div className="server-status" role="status" aria-live="polite">
      <span className={`status-dot ${data ? 'online' : ''}`} />
      <span>
        {isPending
          ? 'Connecting to server…'
          : isError
            ? 'Server is unavailable'
            : 'Server is running'}
      </span>
      {isError && (
        <button className="retry-button" onClick={() => void refetch()} disabled={isFetching}>
          <RotateCw size={12} aria-hidden="true" /> {isFetching ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  );
}

export function LandingPage() {
  const authenticated = useAuth((state) => state.status === 'authenticated');
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a href="/" className="brand" aria-label="linkup home">
          <span className="brand-mark">
            <ArrowUpRight size={20} strokeWidth={2.5} />
          </span>
          linkup<span className="brand-period">.</span>
        </a>
        <nav aria-label="Main navigation">
          <a href={authenticated ? '/dashboard' : '/login'}>
            {authenticated ? 'Dashboard' : 'Sign in'}
          </a>
          <a href="#how-it-works">
            How it works <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </nav>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="small-line" /> A little direction. A lot of possibility.
            </p>
            <h1 id="hero-title">
              Your next chapter
              <br />
              starts with a <span>plan.</span>
            </h1>
            <p className="hero-description">
              Connect what you know with where you want to go. A personal learning path, one
              manageable step at a time.
            </p>
            <Button asChild>
              <a href={authenticated ? '/dashboard' : '/register'}>
                {authenticated ? 'Go to your dashboard' : 'Start your journey'}{' '}
                <ArrowDown size={16} aria-hidden="true" />
              </a>
            </Button>
            <p className="hero-note">For students, career switchers, and curious minds.</p>
          </div>

          <div className="path-preview" aria-label="Example learning path">
            <div className="preview-heading">
              <span>THE BIG PICTURE</span>
              <span className="example-badge">Example path</span>
            </div>
            <h2>From curious to capable.</h2>
            <p>A clear direction, at your own pace.</p>
            <ol className="path-steps">
              <li>
                <span className="path-node complete">
                  <Check size={15} aria-hidden="true" />
                </span>
                <div>
                  <strong>Where you are</strong>
                  <span>Your skills & experience</span>
                </div>
                <span className="path-tag">Start here</span>
              </li>
              <li>
                <span className="path-node current">
                  <span />
                </span>
                <div>
                  <strong>What comes next</strong>
                  <span>Learn, practice, build</span>
                </div>
              </li>
              <li>
                <span className="path-node destination">
                  <ArrowUpRight size={16} aria-hidden="true" />
                </span>
                <div>
                  <strong>Where you want to be</strong>
                  <span>Your next role or skill</span>
                </div>
              </li>
            </ol>
            <div className="preview-footer">
              <span className="tiny-star">✳</span> Progress, one step at a time.
            </div>
          </div>
        </section>

        <section className="how-section" id="how-it-works" aria-labelledby="how-title">
          <div className="section-heading">
            <p className="eyebrow">A SIMPLE WAY FORWARD</p>
            <h2 id="how-title">Less guesswork. More progress.</h2>
          </div>
          <div className="feature-grid">
            {steps.map(({ icon: Icon, number, title, detail }) => (
              <article className="feature" key={number}>
                <div className="feature-top">
                  <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                  <span>{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </section>
        <aside className="build-notice">
          <span className="notice-label">WORK IN PROGRESS</span>
          <p>
            Your account is the first step. Skill profiles and personal learning plans are coming
            next.
          </p>
        </aside>
      </main>
      <footer className="site-footer">
        <span>linkup · A small step toward what’s next.</span>
        <ServerStatus />
      </footer>
    </div>
  );
}
