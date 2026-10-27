import type { ReactNode } from 'react';

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
    <header className={`page-heading ${className}`.trim()}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="auth-description">{description}</p>}
      </div>
      {children && <div className="page-heading-actions">{children}</div>}
    </header>
  );
}
