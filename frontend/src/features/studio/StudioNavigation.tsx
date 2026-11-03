import { Link } from 'react-router-dom';
export function StudioNavigation({ youtube = false }: { youtube?: boolean }) {
  return (
    <nav
      aria-label="Learning Studio sections"
      className="studio-heading"
      style={{ marginBottom: 24, justifyContent: 'flex-start', gap: 12, flexWrap: 'wrap' }}
    >
      <Link
        to="/studio"
        className={`button ${youtube ? 'button-outline' : 'button-glow'}`}
        aria-current={!youtube ? 'page' : undefined}
      >
        Learning shelf
      </Link>
      <Link
        to="/studio?view=youtube"
        className={`button ${youtube ? 'button-glow' : 'button-outline'}`}
        aria-current={youtube ? 'page' : undefined}
      >
        YouTube videos and plans
      </Link>
    </nav>
  );
}
