import type { CatalogPlant } from '@hochbeet/contracts';
import { CircleCheck, Clock, Lock, Send, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/context';
import { publicationState, type PublicationState } from '@/lib/catalog';
import { useRequestPublication } from '@/lib/garden';
import { ownNeighbors } from '@/lib/plant-form';
import { cn } from '@/lib/utils';

const STATE: Record<
  PublicationState,
  { icon: LucideIcon; title: string; text: string; className: string }
> = {
  PRIVATE: {
    icon: Lock,
    title: 'Privat',
    text: 'Nur du siehst diese Sorte. Schlag sie vor, damit alle sie nutzen können.',
    className: 'bg-card',
  },
  PENDING: {
    icon: Clock,
    title: 'Angefragt',
    text: 'Die Sorte wartet auf die Freigabe durch die Admins. Bis dahin kannst du sie wie gewohnt nutzen.',
    className: 'border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40',
  },
  REJECTED: {
    icon: TriangleAlert,
    title: 'Abgelehnt',
    text: 'Die Admins haben die Sorte nicht freigegeben. Du kannst sie anpassen und erneut vorschlagen.',
    className: 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40',
  },
  PUBLISHED: {
    icon: CircleCheck,
    title: 'Veröffentlicht',
    text: 'Die Sorte steht jetzt allen im Katalog zur Verfügung.',
    className: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40',
  },
};

/** Publication status of an own plant and „Für alle vorschlagen“ (needs an account). */
export function PublicationPanel({
  plant,
  catalog,
}: {
  plant: CatalogPlant;
  catalog: readonly CatalogPlant[];
}) {
  const { guest } = useAuth();
  const request = useRequestPublication(plant.id);
  const state = publicationState(plant);
  const { icon: Icon, title, text, className } = STATE[state];
  const blocking = ownNeighbors(plant, catalog);
  const canRequest = !guest && (state === 'PRIVATE' || state === 'REJECTED');

  return (
    <section
      aria-labelledby="publication"
      className={cn('flex flex-col gap-3 rounded-xl border p-4', className)}
      data-testid="publication"
      data-state={state.toLowerCase()}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="flex flex-col gap-1">
          <h2 id="publication" className="font-semibold">
            Status: {title}
          </h2>
          <p className="text-muted-foreground text-sm">{text}</p>
          {state === 'REJECTED' && plant.publication?.rejectionComment && (
            <blockquote className="mt-1 border-l-2 border-amber-500 pl-3 text-sm">
              <span className="sr-only">Kommentar der Admins: </span>
              {plant.publication.rejectionComment}
            </blockquote>
          )}
        </div>
      </div>
      {canRequest && blocking.length > 0 && (
        <p className="text-sm">
          Vorschlagen geht nur mit Nachbarn aus dem gemeinsamen Katalog. Entferne dafür zuerst{' '}
          {blocking.map((p) => p.name).join(', ')} aus den Nachbarn.
        </p>
      )}
      {guest && (
        <p className="text-sm">
          <Link to="/anmelden" className="text-primary font-medium hover:underline">
            Melde dich an
          </Link>
          , um die Sorte für alle vorzuschlagen.
        </p>
      )}
      {request.isError && <FormMessage tone="error">{apiErrorMessage(request.error)}</FormMessage>}
      {canRequest && (
        <Button
          className="h-11 self-start md:h-9"
          disabled={blocking.length > 0 || request.isPending}
          onClick={() => {
            request.mutate();
          }}
        >
          <Send aria-hidden />
          {state === 'REJECTED' ? 'Erneut vorschlagen' : 'Für alle vorschlagen'}
        </Button>
      )}
    </section>
  );
}
