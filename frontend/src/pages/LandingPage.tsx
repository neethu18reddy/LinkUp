import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  Check,
  Compass,
  Route,
  RotateCw,
  Sparkles,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { getHealth } from '@/lib/api';
import { useAuth } from '@/store/auth';
import {
  FadeIn,
  StaggerContainer,
  StaggerItem,
  GlowCard,
} from '@/components/ui/animated-container';

const steps = [
  {
    icon: Compass,
    number: '01',
    title: 'Find your direction',
    detail: 'Start with what you know and where you want to go.',
    gradient: 'from-[#225c47] to-[#3a8a65]',
  },
  {
    icon: Route,
    number: '02',
    title: 'Make a plan that fits',
    detail: 'A clear learning path, built around your available time.',
    gradient: 'from-[#3a8a65] to-[#5aaa80]',
  },
  {
    icon: BookOpen,
    number: '03',
    title: 'Learn. Build. Move forward.',
    detail: 'Turn small steps into skills you can put to work.',
    gradient: 'from-[#5aaa80] to-[#7bc49a]',
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
      <motion.header
        className="site-header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
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
      </motion.header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <FadeIn delay={0.1}>
              <p className="eyebrow">
                <span className="small-line" />
                <Sparkles size={14} className="text-[#438b65]" aria-hidden="true" />A little
                direction. A lot of possibility.
              </p>
            </FadeIn>
            <FadeIn delay={0.2}>
              <h1 id="hero-title">
                Your next chapter
                <br />
                starts with a <span>plan.</span>
              </h1>
            </FadeIn>
            <FadeIn delay={0.3}>
              <p className="hero-description">
                Connect what you know with where you want to go. A personal learning path, one
                manageable step at a time.
              </p>
            </FadeIn>
            <FadeIn delay={0.4}>
              <Button asChild>
                <a href={authenticated ? '/dashboard' : '/register'}>
                  {authenticated ? 'Go to your dashboard' : 'Start your journey'}{' '}
                  <motion.span
                    animate={{ y: [0, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </motion.span>
                </a>
              </Button>
            </FadeIn>
            <FadeIn delay={0.5}>
              <p className="hero-note">
                <Zap size={12} className="inline text-[#438b65]" aria-hidden="true" /> For students,
                career switchers, and curious minds.
              </p>
            </FadeIn>
          </div>

          <FadeIn delay={0.3} direction="left">
            <motion.div
              className="path-preview"
              aria-label="Example learning path"
              whileHover={{ y: -4, boxShadow: '0 16px 50px #1d3e2c0a' }}
              transition={{ duration: 0.3 }}
            >
              <div className="preview-heading">
                <span>THE BIG PICTURE</span>
                <span className="example-badge">
                  <TrendingUp size={10} className="inline mr-1" aria-hidden="true" />
                  Example path
                </span>
              </div>
              <h2>From curious to capable.</h2>
              <p>A clear direction, at your own pace.</p>
              <ol className="path-steps">
                <motion.li
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <span className="path-node complete">
                    <Check size={15} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Where you are</strong>
                    <span>Your skills & experience</span>
                  </div>
                  <span className="path-tag">Start here</span>
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.75 }}
                >
                  <span className="path-node current">
                    <motion.span
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                  </span>
                  <div>
                    <strong>What comes next</strong>
                    <span>Learn, practice, build</span>
                  </div>
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <span className="path-node destination">
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Where you want to be</strong>
                    <span>Your next role or skill</span>
                  </div>
                </motion.li>
              </ol>
              <div className="preview-footer">
                <motion.span
                  className="tiny-star"
                  animate={{ rotate: [0, 180, 360] }}
                  transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
                >
                  ✳
                </motion.span>
                Progress, one step at a time.
              </div>
            </motion.div>
          </FadeIn>
        </section>

        <section className="how-section" id="how-it-works" aria-labelledby="how-title">
          <FadeIn>
            <div className="section-heading">
              <p className="eyebrow">A SIMPLE WAY FORWARD</p>
              <h2 id="how-title">Less guesswork. More progress.</h2>
            </div>
          </FadeIn>
          <StaggerContainer className="feature-grid">
            {steps.map(({ icon: Icon, number, title, detail, gradient }) => (
              <StaggerItem key={number}>
                <GlowCard className="feature h-full">
                  <div className="feature-top">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} text-white`}
                    >
                      <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                    </div>
                    <span className="text-xs text-[#b4bfb5] font-mono">{number}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </GlowCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
        <FadeIn>
          <aside className="build-notice">
            <span className="notice-label">WORK IN PROGRESS</span>
            <p>
              Your account is the first step. Skill profiles and personal learning plans are coming
              next.
            </p>
          </aside>
        </FadeIn>
      </main>
      <motion.footer
        className="site-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <span>linkup · A small step toward what's next.</span>
        <ServerStatus />
      </motion.footer>
    </div>
  );
}
