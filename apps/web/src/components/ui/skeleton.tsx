import { cn } from '@/lib/utils';

/** Grey placeholder in the shape of content that is still loading. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('bg-muted animate-pulse rounded-md motion-reduce:animate-none', className)}
    />
  );
}

/** Placeholder list while data loads; screen readers hear the label once. */
export function SkeletonList({
  label,
  count = 6,
  itemClassName = 'h-16 rounded-xl',
  className = 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3',
}: {
  label: string;
  count?: number;
  itemClassName?: string;
  className?: string;
}) {
  return (
    <div className={className} aria-busy="true" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={itemClassName} />
      ))}
    </div>
  );
}
