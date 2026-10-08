import type { Bed } from '@hochbeet/contracts';
import { Link } from '@tanstack/react-router';
import { weekStart } from '@hochbeet/garden-rules';
import { Pencil, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { activePlantings } from '@/lib/active-plantings';
import { seasonFindings } from '@/lib/editor/warnings';
import { useBedWithPlantings, usePlants } from '@/lib/garden';
import { BedFormDialog } from './BedFormDialog';
import { BedPreview } from './BedPreview';
import { DeleteBedDialog } from './DeleteBedDialog';

const directionLabel = { H: 'Reihen parallel zur Breite', V: 'Reihen parallel zur Tiefe' };

/** One bed in the overview: mini preview of the current week, size, edit and delete. */
export function BedCard({ bed, today }: { bed: Bed; today: Date }) {
  const details = useBedWithPlantings(bed.id);
  const plants = usePlants();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const plantings = details.data?.plantings ?? [];
  const active = activePlantings(plantings, plants.data ?? [], today).length;
  const warnings = seasonFindings(bed, plantings, plants.data ?? [], weekStart(today)).filter(
    (f) => f.severity === 'WARNING',
  ).length;

  return (
    <Card
      className="relative flex flex-col gap-3 p-4"
      aria-labelledby={`bed-${bed.id}-name`}
      role="article"
    >
      <div className="grid h-32 place-items-center">
        <BedPreview bed={bed} plantings={plantings} plants={plants.data ?? []} date={today} />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={`bed-${bed.id}-name`} className="truncate font-semibold">
            <Link
              to="/beete/$bedId"
              params={{ bedId: bed.id }}
              className="after:absolute after:inset-0 hover:underline"
            >
              {bed.name}
            </Link>
          </h2>
          <p className="text-muted-foreground text-sm">
            {bed.widthCm} × {bed.depthCm} cm · {directionLabel[bed.mainRowDirection]}
          </p>
          <p className="text-muted-foreground text-xs">
            {plantings.length === 0
              ? 'Noch keine Pflanzungen'
              : `${String(active)} ${active === 1 ? 'Pflanzung' : 'Pflanzungen'} in dieser Woche`}
          </p>
          {plantings.length > 0 && (
            <p
              data-testid="season-warnings"
              className={
                warnings > 0
                  ? 'flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400'
                  : 'text-muted-foreground text-xs'
              }
            >
              {warnings > 0 && <TriangleAlert aria-hidden className="size-3.5" />}
              {warnings === 0
                ? 'Keine Warnungen in dieser Saison'
                : `${String(warnings)} ${warnings === 1 ? 'Warnung' : 'Warnungen'} in dieser Saison`}
            </p>
          )}
        </div>
        {/* Above the stretched link of the name, so they stay clickable. */}
        <div className="relative z-10 -mr-2 flex shrink-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Beet „${bed.name}“ bearbeiten`}
            onClick={() => {
              setEditing(true);
            }}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Beet „${bed.name}“ löschen`}
            onClick={() => {
              setDeleting(true);
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <BedFormDialog bed={bed} open={editing} onOpenChange={setEditing} />
      <DeleteBedDialog bed={bed} open={deleting} onOpenChange={setDeleting} />
    </Card>
  );
}
