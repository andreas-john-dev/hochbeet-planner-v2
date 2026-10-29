import type { CatalogPlant, SowingBatchFields, SowingWithPlantings } from '@hochbeet/contracts';
import { PlantIcon } from '@hochbeet/plant-icons/react';
import {
  CalendarClock,
  Check,
  ChevronRight,
  MapPin,
  Minus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiErrorMessage } from '@/lib/api';
import { useSaveSowing } from '@/lib/garden';
import {
  advance,
  complete,
  germinationText,
  hasSeedlings,
  nextStage,
  STAGE_LABEL,
  stockOf,
  stockText,
  weekText,
  withAlive,
} from '@/lib/sowings';
import { cn } from '@/lib/utils';
import { DeleteSowingDialog } from './DeleteSowingDialog';
import { SowingFormDialog } from './SowingFormDialog';

/**
 * One batch: plant, sowing week, stage, location and stock, with quick actions at the bottom
 * where thumbs reach them on phones: next stage, stock stepper, complete, edit and delete.
 */
export function SowingCard({
  item,
  plants,
}: {
  item: SowingWithPlantings;
  plants: readonly CatalogPlant[];
}) {
  const { sowing } = item;
  const plant = plants.find((p) => p.id === sowing.plantId);
  const name = plant?.name ?? 'Unbekannte Sorte';
  const save = useSaveSowing();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const next = nextStage(sowing.stage);
  const done = sowing.stage === 'DONE';
  const titleId = `sowing-${sowing.id}`;
  const change = (fields: SowingBatchFields) => {
    save.mutate({ id: sowing.id, fields });
  };
  const germinated = germinationText(sowing);

  return (
    <Card
      role="article"
      aria-labelledby={titleId}
      data-testid={titleId}
      className="flex flex-col gap-3 p-4"
    >
      <div className="flex items-start gap-3">
        {plant && <PlantIcon plant={plant} size={40} decorative />}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 id={titleId} className="font-semibold">
            {name}
          </h3>
          <p className="text-muted-foreground text-sm">{weekText(sowing.sowDate)}</p>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
            done ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground',
          )}
        >
          {STAGE_LABEL[sowing.stage]}
        </span>
      </div>

      <div className="grid gap-1 text-sm">
        <p>
          <span className="font-medium" data-testid="stock">
            {stockText(sowing, stockOf(item, plants))}
          </span>
          {germinated && <span className="text-muted-foreground"> ({germinated})</span>}
        </p>
        {sowing.location && (
          <p className="text-muted-foreground flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden />
            <span className="sr-only">Standort:</span>
            {sowing.location}
          </p>
        )}
        {sowing.plannedTransplantDate && !done && (
          <p className="text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="size-4" aria-hidden />
            Auspflanzen geplant: {weekText(sowing.plannedTransplantDate)}
          </p>
        )}
        {sowing.notes && (
          <p className="text-muted-foreground line-clamp-2 whitespace-pre-line">
            <span className="sr-only">Notiz:</span> {sowing.notes}
          </p>
        )}
      </div>

      {save.isError && <FormMessage tone="error">{apiErrorMessage(save.error)}</FormMessage>}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
        {next && (
          <Button
            variant="secondary"
            className="h-11 md:h-9"
            disabled={save.isPending}
            onClick={() => {
              change(advance(sowing));
            }}
          >
            <ChevronRight aria-hidden />
            Weiter: {STAGE_LABEL[next]}
          </Button>
        )}
        {hasSeedlings(sowing.stage) && !done && (
          <div role="group" aria-label="Bestand" className="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className="md:size-9"
              aria-label="Bestand verringern"
              disabled={save.isPending || sowing.aliveCount === 0}
              onClick={() => {
                change(withAlive(sowing, sowing.aliveCount - 1));
              }}
            >
              <Minus aria-hidden />
            </Button>
            <span aria-live="polite" className="min-w-8 text-center text-sm tabular-nums">
              {sowing.aliveCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="md:size-9"
              aria-label="Bestand erhöhen"
              disabled={save.isPending}
              onClick={() => {
                change(withAlive(sowing, sowing.aliveCount + 1));
              }}
            >
              <Plus aria-hidden />
            </Button>
          </div>
        )}
        {!done && (
          <Button
            variant="outline"
            className="h-11 md:h-9"
            disabled={save.isPending}
            onClick={() => {
              change(complete(sowing));
            }}
          >
            <Check aria-hidden />
            Abschließen
          </Button>
        )}
        <div className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="md:size-9"
            aria-label={`${name} bearbeiten`}
            onClick={() => {
              setEditing(true);
            }}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:size-9"
            aria-label={`${name} löschen`}
            onClick={() => {
              setDeleting(true);
            }}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>

      {editing && (
        <SowingFormDialog sowing={sowing} plants={plants} open onOpenChange={setEditing} />
      )}
      <DeleteSowingDialog item={item} plantName={name} open={deleting} onOpenChange={setDeleting} />
    </Card>
  );
}
