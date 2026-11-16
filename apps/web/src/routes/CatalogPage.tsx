import { PlantIcon } from '@hochbeet/plant-icons/react';
import { Link } from '@tanstack/react-router';
import { Plus, Search } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SourceBadge } from '@/components/catalog/SourceBadge';
import { FormMessage } from '@/components/FormField';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonList } from '@/components/ui/skeleton';
import {
  CATEGORIES,
  type CatalogFilter,
  families,
  FEEDERS,
  filterCatalog,
  NO_FILTER,
} from '@/lib/catalog';
import { usePlants } from '@/lib/garden';
import { useLanguage } from '@/lib/i18n';
import { familyName, plantName } from '@/lib/plant-names';
import { cn } from '@/lib/utils';

/** One option of a filter group; pressed when active. */
function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring/50 h-11 rounded-full border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] md:h-9',
        pressed
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card hover:bg-accent text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** The user's catalogue: global plants (possibly adjusted) and own plants, searchable. */
export function CatalogPage() {
  const { t } = useTranslation('catalog');
  const { language } = useLanguage();
  const plants = usePlants();
  const [filter, setFilter] = useState<CatalogFilter>(NO_FILTER);
  const searchId = useId();
  const familyId = useId();
  const all = plants.data ?? [];
  const shown = filterCatalog(all, filter, language);
  const update = (change: Partial<CatalogFilter>) => {
    setFilter((current) => ({ ...current, ...change }));
  };

  return (
    <>
      <PageHeader title={t('title')} description={t('description')}>
        <Button asChild className="h-11 md:h-10">
          <Link to="/katalog/neu">
            <Plus aria-hidden />
            {t('createOwn')}
          </Link>
        </Button>
      </PageHeader>
      <div className="flex flex-col gap-3" role="search" aria-label={t('list.filters')}>
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            {t('list.search')}
          </label>
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            id={searchId}
            type="search"
            placeholder={t('list.search')}
            value={filter.query}
            onChange={(event) => {
              update({ query: event.target.value });
            }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('list.category')}>
          <Chip
            pressed={filter.category === null}
            onClick={() => {
              update({ category: null });
            }}
          >
            {t('list.all')}
          </Chip>
          {CATEGORIES.map((category) => (
            <Chip
              key={category}
              pressed={filter.category === category}
              onClick={() => {
                update({ category });
              }}
            >
              {t(`category.${category}`)}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('list.feeder')}>
            {FEEDERS.map((feeder) => (
              <Chip
                key={feeder}
                pressed={filter.feeder === feeder}
                onClick={() => {
                  update({ feeder: filter.feeder === feeder ? null : feeder });
                }}
              >
                {t(`feeder.${feeder}`)}
              </Chip>
            ))}
          </div>
          <label htmlFor={familyId} className="sr-only">
            {t('list.family')}
          </label>
          <select
            id={familyId}
            value={filter.family ?? ''}
            onChange={(event) => {
              update({ family: event.target.value === '' ? null : event.target.value });
            }}
            className="bg-card focus-visible:ring-ring/50 h-11 rounded-md border px-3 text-base outline-none focus-visible:ring-[3px] md:h-9 md:text-sm"
          >
            <option value="">{t('list.allFamilies')}</option>
            {families(all, language).map(({ family, label }) => (
              <option key={family} value={family}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {plants.isError ? (
        <div className="mt-6">
          <FormMessage tone="error">{t('loadError')}</FormMessage>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground mt-4 mb-2 text-sm" aria-live="polite">
            {plants.isPending ? '' : t('list.count', { count: shown.length })}
          </p>
          {plants.isPending && <SkeletonList label={t('loading')} count={9} />}
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('list.plants')}>
            {shown.map((plant) => (
              <li key={plant.id}>
                <Link
                  to="/katalog/$plantId"
                  params={{ plantId: plant.id }}
                  className="bg-card hover:bg-accent focus-visible:ring-ring/50 flex min-h-16 items-center gap-3 rounded-xl border p-3 outline-none focus-visible:ring-[3px]"
                >
                  <PlantIcon plant={plant} size={40} decorative />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{plantName(plant, language)}</span>
                      <SourceBadge plant={plant} />
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {familyName(plant, language)} · {t(`feeder.${plant.feeder}`)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {!plants.isPending && shown.length === 0 && (
            <p className="text-muted-foreground mt-6 text-center text-sm">{t('list.none')}</p>
          )}
        </>
      )}
    </>
  );
}
