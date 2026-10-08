import type { CatalogPlant } from '@hochbeet/contracts';

/** Badge for adjusted global plants and own plants. */
export function SourceBadge({ plant }: { plant: CatalogPlant }) {
  if (plant.source === 'OWN') {
    return (
      <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
        Eigene Sorte
      </span>
    );
  }
  if (!plant.overridden) return null;
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
      Angepasst
    </span>
  );
}
