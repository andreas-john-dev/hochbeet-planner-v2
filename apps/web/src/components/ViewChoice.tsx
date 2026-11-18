import { GARDEN_VIEWS } from '@hochbeet/contracts';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useView } from '@/lib/view';

/**
 * Simple or expert view (T-73), each with its sentence: in the profile and in the editor's
 * menu on phones. Switching saves at once.
 */
export function ViewOptions({ labelledBy }: { labelledBy?: string }) {
  const { t } = useTranslation('common');
  const { view, loading, loadError, setView, saveError } = useView();

  if (loading) return <Skeleton className="h-32 w-full rounded-md" />;
  if (loadError) return <FormMessage tone="error">{apiErrorMessage(loadError)}</FormMessage>;
  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : t('view.choose')}
        className="grid gap-2 sm:grid-cols-2"
      >
        {GARDEN_VIEWS.map((value) => {
          const active = view === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (!active) setView(value);
              }}
              className={cn(
                'bg-card flex min-h-11 flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors outline-none',
                'hover:bg-accent focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                active && 'border-primary ring-primary ring-1',
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                {t(`view.${value}`)}
                {active && <Check className="text-primary size-4" aria-hidden />}
              </span>
              <span className="text-muted-foreground text-sm">
                {t(`view.description.${value}`)}
              </span>
            </button>
          );
        })}
      </div>
      {saveError && <FormMessage tone="error">{apiErrorMessage(saveError)}</FormMessage>}
    </div>
  );
}

/** Compact switch for the editor's header on larger screens; the sentence is its title. */
export function ViewSwitch({ id }: { id?: string }) {
  const { t } = useTranslation('common');
  const { view, loading, setView, saveError } = useView();

  return (
    <div
      id={id}
      role="group"
      aria-label={t('view.choose')}
      className="bg-muted flex h-11 rounded-md border p-1"
    >
      {GARDEN_VIEWS.map((value) => {
        const active = view === value;
        return (
          <Button
            key={value}
            variant={active ? 'default' : 'ghost'}
            className="h-full px-3"
            aria-pressed={active}
            title={t(`view.description.${value}`)}
            disabled={loading}
            onClick={() => {
              if (!active) setView(value);
            }}
          >
            {t(`view.${value}`)}
          </Button>
        );
      })}
      {saveError && (
        <span role="alert" className="sr-only">
          {apiErrorMessage(saveError)}
        </span>
      )}
    </div>
  );
}
