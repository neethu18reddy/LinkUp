/* eslint-disable react-refresh/only-export-components */
import { type ReactNode } from 'react';
import { motion, type Variants, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

interface FadeInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}

function FadeIn({ children, className, delay = 0, direction = 'up' }: FadeInProps) {
  const directionMap = {
    up: { y: 24 },
    down: { y: -24 },
    left: { x: 24 },
    right: { x: -24 },
    none: {},
  };

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...directionMap[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

function StaggerContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  );
}

function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}

function GlowCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={cn(
        'group relative rounded-2xl border border-[#e2e8df] bg-white/80 backdrop-blur-sm p-6 transition-all duration-300',
        className,
      )}
      whileHover={{
        y: -2,
        boxShadow: '0 8px 30px rgba(34, 92, 71, 0.08)',
        borderColor: '#a4c2af',
      }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

export {
  FadeIn,
  StaggerContainer,
  StaggerItem,
  GlowCard,
  AnimatePresence,
  fadeInUp,
  fadeIn,
  scaleIn,
  staggerContainer,
  staggerItem,
};
