import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[#f1edfa] text-[#6750a4] border border-[#b8b5ec]',
        secondary: 'bg-[#f1edfa] text-[#6750a4] border border-[#e3dded]',
        outline: 'border border-[#e3dded] text-[#6750a4] bg-transparent',
        destructive: 'bg-[#fff4f1] text-[#9e342e] border border-[#f0d8d0]',
        accent: 'bg-gradient-to-r from-[#6750a4] to-[#6750a4] text-white border-0',
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
