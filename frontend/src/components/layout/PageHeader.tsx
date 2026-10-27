import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

type PageHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  className = '',
  children,
}: PageHeaderProps) {
  return (
    <motion.header
      className={`page-heading ${className}`.trim()}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div>
        <motion.p
          className="eyebrow"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          {eyebrow}
        </motion.p>
        <h1>{title}</h1>
        {description && <p className="auth-description">{description}</p>}
      </div>
      {children && <div className="page-heading-actions">{children}</div>}
    </motion.header>
  );
}
