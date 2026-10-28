import { useRef, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

// Adapted from React Bits TiltedCard's pointer-to-perspective technique.
// Copyright David Haz; see docs/design/react-bits-LICENSE.md.
export function TiltCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const x = useMotionValue(0),
    y = useMotionValue(0);
  const rotateX = useSpring(x, { stiffness: 180, damping: 24 });
  const rotateY = useSpring(y, { stiffness: 180, damping: 24 });
  return (
    <div
      ref={element}
      className={`tilt-scene ${className}`}
      onPointerMove={(event) => {
        if (reduced || event.pointerType !== 'mouse') return;
        const rect = element.current?.getBoundingClientRect();
        if (!rect) return;
        x.set((-(event.clientY - rect.top - rect.height / 2) / rect.height) * 8);
        y.set(((event.clientX - rect.left - rect.width / 2) / rect.width) * 8);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      <motion.div
        style={{
          rotateX: reduced ? 0 : rotateX,
          rotateY: reduced ? 0 : rotateY,
          transformStyle: 'preserve-3d',
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
