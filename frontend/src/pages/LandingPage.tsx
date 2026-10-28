import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Route,
  CalendarDays,
  BookOpen,
  MessageCircle,
  Award,
  ChevronDown,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button } from '@/components/ui/button';
import { TiltCard } from '@/components/ui/tilt-card';
import { useAuth } from '@/store/auth';

gsap.registerPlugin(ScrollTrigger);
const chapters = [
  {
    title: 'Choose your direction.',
    body: 'Start with your skills. Explore career paths or create a goal of your own.',
    label: 'Your goal',
    detail: 'Become a frontend developer',
    items: [
      'Build on what you know',
      'Choose your weekly study time',
      'Make room for something new',
    ],
  },
  {
    title: 'Give your ambition a plan.',
    body: 'Turn a big goal into a roadmap, then a realistic week of learning.',
    label: 'Your week',
    detail: 'A little progress, every day',
    items: [
      'Monday · Learn the foundations',
      'Wednesday · Put it into practice',
      'Saturday · Build a small project',
    ],
  },
  {
    title: 'Make progress you can see.',
    body: 'Log what you learn, finish projects, and bring your questions to your mentor.',
    label: 'Your milestone',
    detail: 'From learning to building',
    items: [
      'Practice with purpose',
      'Keep a record of your work',
      'Celebrate completed milestones',
    ],
  },
];
const features = [
  {
    icon: Route,
    title: 'A path with a purpose',
    body: 'Connected phases, practical topics, and project milestones. Know where you are and what comes next.',
    tag: 'Personal roadmaps',
  },
  {
    icon: CalendarDays,
    title: 'A week that fits your life',
    body: 'Preview your schedule, save your plan, and replan when life changes. Completed work stays with you.',
    tag: 'Weekly planning',
  },
  {
    icon: MessageCircle,
    title: 'Space for every question',
    body: 'Ask for an explanation, work through an exercise, or review your next step with your learning mentor.',
    tag: 'Learning mentor',
  },
  {
    icon: BookOpen,
    title: 'Small steps, made visible',
    body: 'Learning logs, study time, and skill progress tell the story of the effort you put in.',
    tag: 'Progress & projects',
  },
  {
    icon: Award,
    title: 'Something to show for it',
    body: 'Meet your roadmap requirements and share a verifiable record of completion.',
    tag: 'Completion certificates',
  },
];
export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const user = useAuth((state) => state.user);
  const destination = user ? '/dashboard' : '/register';

  useEffect(() => {
    const media = gsap.matchMedia();
    media.add(
      '(min-width: 1000px) and (prefers-reduced-motion: no-preference)',
      () => {
        const cards = gsap.utils.toArray<HTMLElement>('.journey-card', root.current);
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: root.current?.querySelector('.journey-stage'),
            start: 'top 15%',
            end: '+=650',
            scrub: 0.65,
            pin: true,
            invalidateOnRefresh: true,
          },
        });
        cards.forEach((card, index) =>
          timeline.fromTo(
            card,
            { rotateY: -9, rotateX: 6, y: index * 18 },
            { rotateY: 0, rotateX: 0, y: -12, duration: 1 },
            index * 0.4,
          ),
        );
      },
      root,
    );
    return () => media.revert();
  }, []);

  return (
    <div className="landing-v2" ref={root}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="landing-nav">
        <Link to="/" className="brand" aria-label="linkup home">
          <span className="brand-mark">
            <ArrowUpRight size={22} />
          </span>
          linkup<span className="brand-period">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Explore</a>
          <Button asChild variant="outline">
            <Link to={user ? '/dashboard' : '/login'}>
              {user ? 'My workspace' : 'Sign in'}
              <ArrowUpRight size={16} />
            </Link>
          </Button>
        </nav>
      </header>
      <main id="main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <h1>
              Your next chapter.
              <br />
              <span>One step closer.</span>
            </h1>
            <p>
              Turn “I want to learn” into a path you can follow. Your goals, a practical weekly
              plan, and a little guidance—all in one place.
            </p>
            <div className="landing-actions">
              <Button asChild>
                <Link to={destination}>
                  {user ? 'Continue learning' : 'Build my learning path'}
                  <ArrowRight size={18} />
                </Link>
              </Button>
              <a className="walkthrough-link" href="#how-it-works">
                Take a look around <ChevronDown size={16} />
              </a>
            </div>
            <p className="landing-caption">Your pace. Your direction. Your progress.</p>
          </div>

          <div className="hero-visual">
            <TiltCard className="hero-path">
              <div className="path-art">
                <div className="path-art-heading">
                  <span>Your next chapter</span>
                  <span className="sample-label">Example roadmap</span>
                </div>
                <h2>
                  Ideas become
                  <br />
                  things you can build.
                </h2>
                <ol className="art-steps">
                  <li>
                    <span className="art-node done">
                      <Check size={18} />
                    </span>
                    <div>
                      <strong>Find your starting point</strong>
                      <small>Your skills + your ambitions</small>
                    </div>
                  </li>
                  <li>
                    <span className="art-node current">2</span>
                    <div>
                      <strong>Make time for what’s next</strong>
                      <small>A plan for your real life</small>
                    </div>
                  </li>
                  <li>
                    <span className="art-node">3</span>
                    <div>
                      <strong>Build something of your own</strong>
                      <small>Learn it. Try it. Make it yours.</small>
                    </div>
                  </li>
                </ol>
                <div className="art-note">
                  <Route size={20} />
                  <span>A clear path. Room to grow.</span>
                  <ArrowUpRight size={20} />
                </div>
              </div>

              <div className="floating-note">
                <Check size={18} />
                <span>
                  One small step
                  <br />
                  <strong>is still a step forward.</strong>
                </span>
              </div>
            </TiltCard>
          </div>
        </section>

        <section className="landing-intro" id="how-it-works">
          <h2>
            Less figuring out.
            <br />
            More moving forward.
          </h2>
          <p>
            Too many tabs. Too many tutorials. No clear next step. Linkup connects what you already
            know with where you want to go, so you can spend your time learning.
          </p>
        </section>

        <section className="journey-stage" aria-label="How linkup works">
          <div className="journey-grid">
            {chapters.map((chapter, index) => (
              <article className="journey-card" key={chapter.title}>
                <span className="journey-number">0{index + 1}</span>
                <h3>{chapter.title}</h3>
                <p>{chapter.body}</p>
                <div className="journey-example">
                  <span>{chapter.label} · example</span>
                  <strong>{chapter.detail}</strong>
                  <ul>
                    {chapter.items.map((item) => (
                      <li key={item}>
                        <Check size={15} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="landing-features">
          <div className="features-heading">
            <h2>
              Everything connects.
              <br />
              <span>Especially your progress.</span>
            </h2>
            <p>
              A learning workspace that grows with you, from your first goal to your next milestone.
            </p>
          </div>
          <div className="feature-editorial">
            {features.map(({ icon: Icon, title, body, tag }, index) => (
              <article key={title}>
                <div className="feature-label">
                  <Icon size={22} />
                  <span>{tag}</span>
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
                {index === 0 && (
                  <div
                    className="mini-roadmap"
                    aria-label="Example path: foundations, practice, project"
                  >
                    <span>Foundations</span>
                    <ArrowRight size={16} />
                    <span>Practice</span>
                    <ArrowRight size={16} />
                    <span>Project</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="landing-faq">
          <h2>
            A few things
            <br />
            you might wonder.
          </h2>
          <div>
            {[
              [
                'Can I create my own goal?',
                'Yes. Explore the career catalogue or enter a custom goal. Your path starts with what you want to learn.',
              ],
              [
                'How does the mentor work?',
                'The mentor helps you think through your learning. Live AI availability depends on the configured provider and its quota; the conversation shows when offline guidance is being used.',
              ],
              [
                'What does a certificate mean?',
                'A certificate records completion of the requirements in your Linkup roadmap. It is not an accredited qualification or a guarantee of employment.',
              ],
              [
                'What if my schedule changes?',
                'Adjust your plan and replan your remaining work. Your completed tasks and saved learning history stay with you.',
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={18} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-final">
          <h2>
            Your future starts
            <br />
            with your next step.
          </h2>
          <Button asChild>
            <Link to={destination}>
              {user ? 'Open my workspace' : 'Find my starting point'}
              <ArrowUpRight size={20} />
            </Link>
          </Button>
          <p>No perfect starting point needed.</p>
        </section>
      </main>

      <footer className="landing-footer">
        <Link to="/" className="brand">
          linkup.
        </Link>
        <span>Small steps. Real progress.</span>
        <Link to={user ? '/dashboard' : '/login'}>
          {user ? 'My workspace' : 'Sign in'} <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
