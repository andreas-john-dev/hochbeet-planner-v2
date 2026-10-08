import { formatWeek } from '@hochbeet/garden-rules';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Maximize, MapPinOff, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { BedCanvas } from '@/components/editor/BedCanvas';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { activePlantings } from '@/lib/active-plantings';
import { createEditorStore } from '@/lib/editor/store';
import { useBedWithPlantings, usePlants } from '@/lib/garden';

const ZOOM_STEP = 1.4;

/** Bed editor: the bed true to scale with grid, plantings of the current week, zoom and pan. */
/** Route component for /beete/$bedId; remounts per bed so the editor state starts fresh. */
export function BedEditorPage() {
  const bedId = bedIdParam(useParams({ strict: false }));
  return <BedEditor key={bedId} bedId={bedId} />;
}

// Params are untyped here: typing them via the route would make router.tsx circular.
function bedIdParam(params: unknown): string {
  const value = (params as { bedId?: unknown } | null)?.bedId;
  return typeof value === 'string' ? value : '';
}

function BedEditor({ bedId }: { bedId: string }) {
  const details = useBedWithPlantings(bedId);
  const plants = usePlants();
  const [store] = useState(createEditorStore);
  const [today] = useState(() => new Date());
  const { range, week } = formatWeek(today);

  const backLink = (
    <Link
      to="/beete"
      className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Alle Beete
    </Link>
  );

  if (details.isError) {
    const notFound = details.error instanceof ApiError && details.error.status === 404;
    return (
      <div className="flex flex-col gap-6">
        {backLink}
        {notFound ? (
          <EmptyState icon={MapPinOff} title="Beet nicht gefunden">
            Dieses Beet gibt es nicht oder nicht mehr.
          </EmptyState>
        ) : (
          <FormMessage tone="error">
            Das Beet konnte nicht geladen werden. Bitte lade die Seite neu.
          </FormMessage>
        )}
      </div>
    );
  }

  const bed = details.data?.bed;
  const shown = activePlantings(details.data?.plantings ?? [], plants.data ?? [], today);

  return (
    <div className="flex flex-col gap-4">
      {backLink}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
            {bed?.name ?? 'Beet'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {bed && `${String(bed.widthCm)} × ${String(bed.depthCm)} cm · `}
            {range} <span className="text-xs">{week}</span>
          </p>
        </div>
        <div className="flex gap-2" role="toolbar" aria-label="Ansicht">
          <Button
            variant="outline"
            size="icon"
            aria-label="Verkleinern"
            onClick={() => {
              store.getState().zoomBy(1 / ZOOM_STEP);
            }}
          >
            <Minus />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Vergrößern"
            onClick={() => {
              store.getState().zoomBy(ZOOM_STEP);
            }}
          >
            <Plus />
          </Button>
          <Button
            variant="outline"
            className="h-11"
            disabled={!bed}
            onClick={() => {
              if (bed) store.getState().fit(bed);
            }}
          >
            <Maximize aria-hidden />
            Auf Beet einpassen
          </Button>
        </div>
      </div>
      <div className="bg-card h-[60dvh] min-h-72 overflow-hidden rounded-xl border md:h-[65dvh]">
        {bed && plants.data ? (
          <BedCanvas bed={bed} plantings={shown} store={store} />
        ) : (
          <div className="bg-muted h-full animate-pulse" aria-busy="true">
            <span className="sr-only">Beet wird geladen …</span>
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        Zoomen mit dem Mausrad oder zwei Fingern, verschieben durch Ziehen.
      </p>
    </div>
  );
}
