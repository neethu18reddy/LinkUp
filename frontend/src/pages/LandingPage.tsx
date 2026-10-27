import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Compass,
  Route,
  RotateCw,
  Sparkles,
  Activity,
  Layers,
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
    detail:
      'Start with what you know and where you want to go. Explore roles mapped to real industry demand.',
    gradient: 'from-[#046d42] to-[#10b981]',
  },
  {
    icon: Route,
    number: '02',
    title: 'Make a plan that fits',
    detail:
      'A clear learning path, built around your available weekly hours, learning rhythm, and target milestones.',
    gradient: 'from-[#10b981] to-[#06b6d4]',
  },
  {
    icon: BookOpen,
    number: '03',
    title: 'Learn. Build. Move forward.',
    detail:
      'Turn weekly micro-steps into concrete project artifacts you can showcase directly in your portfolio.',
    gradient: 'from-[#06b6d4] to-[#3b82f6]',
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
    <div className="site-shell relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute -top-40 -left-40 w-[32rem] h-[32rem] rounded-full bg-emerald-400/15 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-[36rem] h-[36rem] rounded-full bg-cyan-400/10 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-[28rem] h-[28rem] rounded-full bg-emerald-500/10 blur-[130px] pointer-events-none" />

      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <motion.header
        className="site-header relative z-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <a href="/" className="brand" aria-label="linkup home">
          <span className="brand-mark shadow-sm shadow-emerald-700/20">
            <ArrowUpRight size={20} strokeWidth={2.5} />
          </span>
          linkup<span className="brand-period">.</span>
        </a>

        <div className="flex items-center gap-4">
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/5 border border-emerald-800/10 shadow-sm text-xs text-emerald-800 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
            </span>
            <span>99.98% System Uptime</span>
          </div>

          <nav aria-label="Main navigation" className="flex items-center gap-3">
            <a
              href="#how-it-works"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-emerald-900/70 hover:text-emerald-900"
            >
              How it works
            </a>
            <Button variant={authenticated ? 'glow' : 'outline'} asChild>
              <a href={authenticated ? '/dashboard' : '/login'}>
                {authenticated ? 'Dashboard' : 'Sign in'}
              </a>
            </Button>
          </nav>
        </div>
      </motion.header>

      <main id="main" className="relative z-10">
        {/* HERO SECTION */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <FadeIn delay={0.1}>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-8 h-[2px] bg-emerald-600 rounded-full" />
                <p className="eyebrow !m-0 !tracking-widest uppercase font-bold text-xs text-emerald-700">
                  <Sparkles size={14} className="text-emerald-600 inline mr-1" aria-hidden="true" />
                  A little direction. A lot of possibility.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <h1 id="hero-title" className="leading-[1.12]">
                Your next chapter
                <br />
                starts with a{' '}
                <span className="relative inline-block text-emerald-700 italic font-semibold underline decoration-emerald-300 decoration-4 underline-offset-4">
                  plan.
                </span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.3}>
              <p className="hero-description text-base text-gray-600 leading-relaxed max-w-xl">
                Connect what you know with where you want to go. Intelligent, self-paced career
                transition maps tailored to your exact background, time constraints, and cognitive
                rhythm.
              </p>
            </FadeIn>

            <FadeIn delay={0.4}>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="glow"
                  asChild
                  className="px-6 py-3 text-sm font-semibold shadow-lg shadow-emerald-500/20"
                >
                  <a href={authenticated ? '/dashboard' : '/register'}>
                    {authenticated ? 'Go to your dashboard' : 'Start your journey'}
                    <motion.span
                      className="inline-block ml-1"
                      animate={{ x: [0, 4, 0] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                    >
                      <ArrowRight size={16} aria-hidden="true" />
                    </motion.span>
                  </a>
                </Button>
                <Button variant="outline" asChild className="px-5 py-3 text-sm">
                  <a href="#how-it-works">
                    Explore trajectories <ArrowDown size={14} className="ml-1" aria-hidden="true" />
                  </a>
                </Button>
              </div>
            </FadeIn>

            {/* Metric Proof Ribbons */}
            <FadeIn delay={0.5}>
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-emerald-950/10 mt-6 max-w-lg">
                <div className="flex flex-col">
                  <span className="font-bold text-xl text-emerald-950 tracking-tight">14,200+</span>
                  <span className="text-[11px] uppercase tracking-wider text-emerald-900/60 font-medium">
                    Pivots Mapped
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xl text-emerald-950 tracking-tight">8.4 hrs</span>
                  <span className="text-[11px] uppercase tracking-wider text-emerald-900/60 font-medium">
                    Avg Weekly Pace
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xl text-emerald-950 tracking-tight">91.6%</span>
                  <span className="text-[11px] uppercase tracking-wider text-emerald-900/60 font-medium">
                    Attainment Rate
                  </span>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Interactive Glassmorphic Milestone Visualizer */}
          <FadeIn delay={0.3} direction="left">
            <motion.div
              className="path-preview backdrop-blur-xl bg-white/90 border border-emerald-800/15 shadow-2xl shadow-emerald-950/10 rounded-2xl p-6"
              aria-label="Example learning path"
              whileHover={{ y: -4, boxShadow: '0 24px 60px rgba(4, 109, 66, 0.15)' }}
              transition={{ duration: 0.3 }}
            >
              <div className="preview-heading flex items-center justify-between pb-3 border-b border-emerald-950/10">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-emerald-600 animate-pulse" />
                  <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-900/70 font-semibold">
                    Interactive Trajectory · Simulation
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                  EST. 14 WEEKS
                </span>
              </div>

              <div className="pt-4 pb-2">
                <h2 className="text-xl font-bold text-emerald-950">From curious to capable.</h2>
                <p className="text-xs text-gray-500 mt-1">
                  A clear direction, built around your weekly cadence.
                </p>
              </div>

              <ol className="path-steps space-y-4 my-4">
                <motion.li
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <span className="path-node complete flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
                    <Check size={14} strokeWidth={3} aria-hidden="true" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <strong className="block text-xs font-semibold text-emerald-950">
                      Foundational Gap Bridging
                    </strong>
                    <span className="block text-[11px] text-emerald-800/70">
                      Your skills verified & benchmarked
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-200/70 text-emerald-800 font-semibold">
                    Verified
                  </span>
                </motion.li>

                <motion.li
                  className="flex flex-col gap-2 p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/30 shadow-sm"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.75 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600 shadow-sm shadow-emerald-500" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <strong className="block text-xs font-semibold text-emerald-950">
                        Applied Micro-Projects
                      </strong>
                      <span className="block text-[11px] text-emerald-800/70">
                        Sprint 03 · REST APIs & State Mgmt
                      </span>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold tracking-wider">
                      58% Done
                    </span>
                  </div>
                  {/* Glowing progress bar */}
                  <div className="w-full bg-emerald-950/10 rounded-full h-1.5 overflow-hidden mt-1">
                    <motion.div
                      className="bg-gradient-to-r from-emerald-600 to-teal-400 h-1.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                      initial={{ width: 0 }}
                      animate={{ width: '58%' }}
                      transition={{ duration: 1.2, delay: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </motion.li>

                <motion.li
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/70 border border-gray-100"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <span className="path-node destination flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-600">
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <strong className="block text-xs font-semibold text-gray-800">
                      Target Role Readiness
                    </strong>
                    <span className="block text-[11px] text-gray-500">
                      Portfolio, Capstone & Mock Interviews
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-gray-200/70 text-gray-600 font-medium">
                    Goal
                  </span>
                </motion.li>
              </ol>

              <div className="preview-footer flex items-center justify-between pt-3 border-t border-emerald-950/10 text-[11px] text-emerald-900/70">
                <div className="flex items-center gap-1.5 font-medium">
                  <motion.span
                    className="inline-block text-emerald-600 font-bold"
                    animate={{ rotate: [0, 180, 360] }}
                    transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
                  >
                    ✳
                  </motion.span>
                  Progress, one step at a time.
                </div>
                <span className="font-mono text-[10px] font-bold text-emerald-700">
                  94.2% Probability
                </span>
              </div>
            </motion.div>
          </FadeIn>
        </section>

        {/* BENTO FEATURE SECTION */}
        <section className="how-section" id="how-it-works" aria-labelledby="how-title">
          <FadeIn>
            <div className="section-heading text-center max-w-xl mx-auto mb-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold tracking-wider uppercase mb-3">
                <Layers size={13} />A Simple Way Forward
              </div>
              <h2 id="how-title" className="text-3xl font-bold text-emerald-950">
                Less guesswork. More progress.
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                Structured systems replace overwhelm with measurable momentum.
              </p>
            </div>
          </FadeIn>

          <StaggerContainer className="feature-grid grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map(({ icon: Icon, number, title, detail, gradient }) => (
              <StaggerItem key={number}>
                <GlowCard className="feature h-full p-6 bg-white/95 rounded-2xl border border-emerald-900/10 shadow-lg shadow-emerald-950/5 hover:border-emerald-500/40 hover:shadow-emerald-500/10 transition-all">
                  <div className="feature-top flex items-center justify-between mb-4">
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md shadow-emerald-700/25`}
                    >
                      <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
                    </div>
                    <span className="text-sm text-emerald-700/60 font-mono font-bold">
                      {number}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-emerald-950 mb-2">{title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{detail}</p>
                </GlowCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>

        {/* WORK IN PROGRESS NOTICE */}
        <FadeIn>
          <aside className="build-notice my-8 p-6 rounded-2xl bg-gradient-to-r from-emerald-950/5 via-teal-950/5 to-emerald-950/5 border border-emerald-800/15 text-center">
            <span className="notice-label inline-block px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-bold tracking-widest uppercase mb-2">
              Work In Progress
            </span>
            <p className="text-sm text-emerald-950 font-medium max-w-lg mx-auto">
              Your account is the first step. Skill profiles, dynamic roadmap generation, and
              personal learning plans are continuously calibrated.
            </p>
          </aside>
        </FadeIn>
      </main>

      <motion.footer
        className="site-footer relative z-10 py-8 px-6 border-t border-emerald-950/10 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <span>linkup · A small step toward what&apos;s next.</span>
        <ServerStatus />
      </motion.footer>
    </div>
  );
}
