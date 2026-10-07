import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'bg-card flex h-11 w-full min-w-0 rounded-md border px-3 text-base shadow-xs transition-colors outline-none md:text-sm',
        'placeholder:text-muted-foreground focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:border-red-600 dark:aria-invalid:border-red-400',
        className,
      )}
      {...props}
    />
  );
}
