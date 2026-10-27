import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[#eaf2e9] text-[#225c47] border border-[#c7d8bd]',
        secondary: 'bg-[#f5f8f4] text-[#65746b] border border-[#e2e8df]',
        outline: 'border border-[#dfe6e1] text-[#4d5f56] bg-transparent',
        destructive: 'bg-[#fff4f1] text-[#9e342e] border border-[#f0d8d0]',
        accent: 'bg-gradient-to-r from-[#225c47] to-[#438b65] text-white border-0',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants };
