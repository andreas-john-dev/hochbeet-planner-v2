import { Sprout } from 'lucide-react';

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">
        <Sprout className="size-[18px]" aria-hidden />
      </span>
      Hochbeet-Planer
    </span>
  );
}
