import { NavLink } from 'react-router-dom';
import { ArrowRight, Target, Route, CalendarDays } from 'lucide-react';
import { motion } from 'framer-motion';

const stepConfig = [
  ['/goals', 'Choose a goal', Target],
  ['/roadmap', 'Build a roadmap', Route],
  ['/plan', 'Plan your week', CalendarDays],
] as const;

export function LearningSteps() {
  return (
    <nav className="learning-steps" aria-label="Build your learning plan">
      {stepConfig.map(([path, title, Icon], index) => (
        <NavLink key={path} to={path}>
          {({ isActive }) => (
            <motion.div
              className="flex items-center gap-2.5 w-full"
              whileHover={{ y: -1 }}
              transition={{ duration: 0.15 }}
            >
              <span className="step-num">{String(index + 1).padStart(2, '0')}</span>
              <Icon
                size={15}
                className={isActive ? 'text-[#225c47]' : 'text-[#8b968c]'}
                aria-hidden="true"
              />
              <span className="step-text font-medium">{title}</span>
              <ArrowRight size={15} className="step-arrow ml-auto" aria-hidden="true" />
            </motion.div>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
