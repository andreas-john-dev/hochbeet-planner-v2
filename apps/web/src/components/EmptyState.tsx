import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center shadow-none">
      <span className="bg-secondary text-secondary-foreground grid size-12 place-items-center rounded-full">
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-sm text-sm">{children}</p>
    </Card>
  );
}
