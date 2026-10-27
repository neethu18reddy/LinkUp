import { NavLink } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function LearningSteps() {
  return (
    <nav className="learning-steps" aria-label="Build your learning plan">
      {[
        ['/goals', 'Choose a goal'],
        ['/roadmap', 'Build a roadmap'],
        ['/plan', 'Plan your week'],
      ].map(([path, title], index) => (
        <NavLink key={path} to={path!}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          {title}
          <ArrowRight size={16} aria-hidden="true" />
        </NavLink>
      ))}
    </nav>
  );
}
