import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn('relative h-2 w-full overflow-hidden rounded-full bg-[#f1edfa]', className)}
    {...props}
  >
    <motion.div
      className={cn(
        'h-full rounded-full bg-gradient-to-r from-[#6750a4] to-[#6750a4]',
        indicatorClassName,
      )}
      initial={{ width: 0 }}
      animate={{ width: `${value ?? 0}%` }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = 'Progress';

export { Progress };
