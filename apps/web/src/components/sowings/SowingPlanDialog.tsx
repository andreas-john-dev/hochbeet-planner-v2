import { MAX_SOWING_COUNT } from '@hochbeet/contracts';
import { formatWeek } from '@hochbeet/garden-rules';
import { PlantIcon } from '@hochbeet/plant-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SkeletonList } from '@/components/ui/skeleton';
import { apiErrorMessage } from '@/lib/api';
import { useApi } from '@/lib/api-context';
import { queryKeys, useAllPlantings, usePlants, useSowings } from '@/lib/garden';
import { buildSowingPlan, saveSowingPlan, type SowingPlanRow } from '@/lib/sowing-plan';
import { cn } from '@/lib/utils';

/**
 * „Anzuchtplan“: what to sow when for the planted out plantings of all beds that have no
 * batch yet, with a reserve for germination losses. Rows can be left out and their amount
 * changed; „Chargen anlegen“ saves a planned batch per row and links its plantings.
 */
export function SowingPlanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Anzuchtplan</DialogTitle>
          <DialogDescription>
            Was du für deine Beete vorziehen musst: aus allen geplanten Pflanzungen ohne Anzucht,
            mit 30 % Reserve für Keimausfälle.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <SowingPlan
            onDone={() => {
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

const countOf = (text: string) => {
  const n = Number(text);
  return text.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= MAX_SOWING_COUNT
    ? n
    : undefined;
};

function SowingPlan({ onDone }: { onDone: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const garden = useAllPlantings();
  const plants = usePlants();
  const sowings = useSowings();
  const [today] = useState(() => new Date());
  const rows = useMemo(
    () =>
      garden.beds && garden.plantings && plants.data && sowings.data
        ? buildSowingPlan(garden.beds, garden.plantings, plants.data, sowings.data, { today })
        : undefined,
    [garden.beds, garden.plantings, plants.data, sowings.data, today],
  );
  // Choices by row key; rows too late to raise start deselected.
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Map<string, unknown>>(new Map());
  const [saving, setSaving] = useState(false);
  // Batches saved by an earlier attempt, so a retry never creates one twice.
  const created = useRef(new Map<string, string>());

  const error = garden.error ?? plants.error ?? sowings.error;
  if (error) return <FormMessage tone="error">{apiErrorMessage(error)}</FormMessage>;
  if (!rows) return <SkeletonList label="Anzuchtplan wird berechnet …" count={3} />;
  if (rows.length === 0) {
    return (
      <>
        <p className="text-muted-foreground text-sm">
          Nichts vorzuziehen: Alle geplanten Pflanzungen ab dieser Woche, die sich vorziehen lassen,
          stammen schon aus einer Anzucht. Setze im Beet Sorten wie Tomaten oder Salat, dann
          erscheinen sie hier.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11 md:h-10" onClick={onDone}>
            Schließen
          </Button>
        </DialogFooter>
      </>
    );
  }

  const isChosen = (row: SowingPlanRow) => chosen[row.key] ?? !row.tooLate;
  const countText = (row: SowingPlanRow) => counts[row.key] ?? String(row.withReserve);
  const selected = rows.filter(isChosen);
  const valid = selected.every((row) => countOf(countText(row)) !== undefined);

  const save = async () => {
    setSaving(true);
    const result = await saveSowingPlan(
      api,
      selected.map((row) => ({ row, count: countOf(countText(row)) ?? row.withReserve })),
      created.current,
    );
    // Whatever was saved shows up: linked plantings leave the plan, batches the raising.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.beds }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sowings }),
    ]);
    setSaving(false);
    setFailed(result);
    if (result.size === 0) onDone();
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && selected.length > 0) void save();
      }}
    >
      {failed.size > 0 && (
        <FormMessage tone="error">
          {`${failed.size === 1 ? 'Eine Zeile wurde' : `${String(failed.size)} Zeilen wurden`} nicht gespeichert. Was gespeichert ist, bleibt erhalten; versuch es noch einmal.`}
        </FormMessage>
      )}
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full text-sm">
          <caption className="sr-only">Was du wann vorziehst</caption>
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th scope="col" className="w-8 py-2 font-medium">
                <span className="sr-only">Anlegen</span>
              </th>
              <th scope="col" className="py-2 pr-2 font-medium">
                Sorte und Aussaat
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">
                Benötigt
              </th>
              <th scope="col" className="w-24 py-2 text-right font-medium">
                Mit Reserve
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PlanRow
                key={row.key}
                row={row}
                chosen={isChosen(row)}
                countText={countText(row)}
                error={failed.get(row.key)}
                disabled={saving}
                onChoose={(value) => {
                  setChosen((previous) => ({ ...previous, [row.key]: value }));
                }}
                onCount={(value) => {
                  setCounts((previous) => ({ ...previous, [row.key]: value }));
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" className="h-11 md:h-10" onClick={onDone}>
          Abbrechen
        </Button>
        <Button
          type="submit"
          className="h-11 md:h-10"
          disabled={saving || !valid || selected.length === 0}
        >
          {saving
            ? 'Wird angelegt …'
            : selected.length === 1
              ? '1 Charge anlegen'
              : `${String(selected.length)} Chargen anlegen`}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PlanRow({
  row,
  chosen,
  countText,
  error,
  disabled,
  onChoose,
  onCount,
}: {
  row: SowingPlanRow;
  chosen: boolean;
  countText: string;
  error: unknown;
  disabled: boolean;
  onChoose: (chosen: boolean) => void;
  onCount: (text: string) => void;
}) {
  const { week, range } = formatWeek(row.sowDate);
  const name = `${row.plant.name}, ${week}`;
  const invalid = chosen && countOf(countText) === undefined;
  const beds = row.beds.map((bed) => `„${bed.name}“`).join(', ');

  return (
    <tr
      data-testid={`plan-row-${row.key}`}
      className={cn('border-b align-top last:border-b-0', !chosen && 'text-muted-foreground')}
    >
      <td className="py-1.5 md:py-3">
        {/* A 44 px touch target on phones around the small checkbox. */}
        <label className="-ml-3 flex size-11 cursor-pointer items-start justify-center pt-3 md:ml-0 md:size-auto md:justify-start md:pt-0.5">
          <input
            type="checkbox"
            className="accent-primary size-4"
            aria-label={`${name} anlegen`}
            checked={chosen}
            disabled={disabled}
            onChange={(event) => {
              onChoose(event.target.checked);
            }}
          />
        </label>
      </td>
      <td className="py-3 pr-2">
        <div className="flex items-start gap-2">
          <PlantIcon plant={row.plant} size={32} decorative className="hidden shrink-0 sm:block" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-foreground font-medium">{row.plant.name}</span>
            <span>
              Aussaat {week} · {range}
            </span>
            <span className="text-muted-foreground text-xs">
              Auspflanzen ab {formatWeek(row.transplantDate).week} in {beds}
            </span>
            {row.tooLate && (
              <span className="flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300">
                <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                Zu spät zum Vorziehen – Jungpflanzen kaufen?
              </span>
            )}
            {error !== undefined && (
              <span role="alert" className="text-xs text-red-700 dark:text-red-400">
                {apiErrorMessage(error)}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 pr-2 text-right tabular-nums">{row.needed}</td>
      <td className="py-3">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_SOWING_COUNT}
          step={1}
          className="ml-auto w-20 text-right"
          aria-label={`Mit Reserve: ${name}`}
          aria-invalid={invalid}
          value={countText}
          disabled={disabled || !chosen}
          onChange={(event) => {
            onCount(event.target.value);
          }}
        />
      </td>
    </tr>
  );
}
