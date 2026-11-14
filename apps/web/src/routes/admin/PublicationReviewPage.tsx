import type { CatalogPlant, Plant } from '@hochbeet/contracts';
import { PlantIcon } from '@hochbeet/plant-icons/react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { format, parseISO } from 'date-fns';
import type { TFunction } from 'i18next';
import { ArrowLeft, Inbox } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlantFormFields } from '@/components/catalog/PlantFormFields';
import { EmptyState } from '@/components/EmptyState';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SkeletonList } from '@/components/ui/skeleton';
import { correctionsFor, similarPlants } from '@/lib/admin';
import { apiErrorMessage } from '@/lib/api';
import { lifecycleText } from '@/lib/catalog';
import { useDecidePublication, usePlants, usePublicationQueue } from '@/lib/garden';
import { useDateLocale, useLanguage } from '@/lib/i18n';
import type { Language } from '@/lib/language';
import { plantForm } from '@/lib/plant-form';
import { sowingLines } from '@/lib/sowing';

/** Route component for /admin/anfragen/$plantId: compare, correct, approve or reject. */
export function PublicationReviewPage() {
  const { t } = useTranslation('admin');
  const plantId = plantIdParam(useParams({ strict: false }));
  const queue = usePublicationQueue();
  const plants = usePlants();
  const request = queue.data?.find((r) => r.plant.id === plantId);

  return (
    <>
      <Link
        to="/admin"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t('title')}
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight md:text-3xl">
        {t('review.title')}
      </h1>
      {queue.isError || plants.isError ? (
        <FormMessage tone="error">{t('review.loadError')}</FormMessage>
      ) : queue.isPending || plants.isPending ? (
        <SkeletonList
          label={t('review.loading')}
          count={5}
          className="flex max-w-2xl flex-col gap-4"
          itemClassName="h-11"
        />
      ) : request ? (
        <Review plant={request.plant} requestedAt={request.requestedAt} catalog={plants.data} />
      ) : (
        <EmptyState icon={Inbox} title={t('review.none')}>
          {t('review.noneText')}
        </EmptyState>
      )}
    </>
  );
}

// Params are untyped here: typing them via the route would make router.tsx circular.
function plantIdParam(params: unknown): string {
  const value = (params as { plantId?: unknown } | null)?.plantId;
  return typeof value === 'string' ? value : '';
}

function Review({
  plant,
  requestedAt,
  catalog,
}: {
  plant: Plant;
  requestedAt: string;
  catalog: readonly CatalogPlant[];
}) {
  const { t } = useTranslation(['admin', 'catalog']);
  const locale = useDateLocale();
  const navigate = useNavigate();
  const decide = useDecidePublication(plant.id);
  const globals = catalog.filter((p) => p.source === 'GLOBAL');
  const toAdmin = () => navigate({ to: '/admin' });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-4">
        <PlantIcon plant={plant} size={56} decorative />
        <div className="flex flex-col gap-0.5">
          <p className="text-xl font-semibold">{plant.name}</p>
          <p className="text-muted-foreground text-sm">
            {t(`catalog:category.${plant.category}`)} · {plant.family}
            {requestedAt &&
              t('review.requestedOn', { date: format(parseISO(requestedAt), 'PPP', { locale }) })}
          </p>
        </div>
      </header>

      <Comparison plant={plant} similar={similarPlants(plant, globals)} catalog={catalog} />

      <section aria-labelledby="approve" className="flex flex-col gap-3">
        <h2 id="approve" className="text-lg font-semibold">
          {t('review.approveTitle')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('review.approveText')}</p>
        <PlantFormFields
          initial={plantForm({ ...plant, source: 'OWN', overridden: false })}
          catalog={catalog}
          neighborCandidates={globals.filter((p) => p.id !== plant.id)}
          submitLabel={t('review.approve')}
          pending={decide.isPending}
          error={decide.error}
          onSubmit={async (fields) => {
            await decide.mutateAsync({ approve: true, corrections: correctionsFor(plant, fields) });
            await toAdmin();
          }}
          onCancel={() => {
            void toAdmin();
          }}
        />
      </section>

      <Reject
        pending={decide.isPending}
        onReject={async (comment) => {
          await decide.mutateAsync({ approve: false, comment });
          await toAdmin();
        }}
      />
    </div>
  );
}

interface Row {
  label: string;
  value: (plant: Plant, nameOf: (id: string) => string) => string;
}

/** The compared values, labelled like on the plant page. */
function rows(t: TFunction<'catalog'>, language: Language): Row[] {
  return [
    { label: t('detail.category'), value: (p) => t(`category.${p.category}`) },
    { label: t('detail.family'), value: (p) => p.family },
    { label: t('detail.feeder'), value: (p) => t(`feeder.${p.feeder}`) },
    {
      label: t('detail.spacingInRow'),
      value: (p) => t('detail.cm', { value: p.spacingInRowCm }),
    },
    { label: t('detail.rowSpacing'), value: (p) => t('detail.cm', { value: p.rowSpacingCm }) },
    { label: t('detail.lifecycle'), value: (p) => lifecycleText(p.lifecycle, language) },
    {
      label: t('detail.frostSensitive'),
      value: (p) => (p.frostSensitive ? t('detail.yes') : t('detail.no')),
    },
    {
      label: t('detail.sowing'),
      value: (p) => (p.sowing ? sowingLines(p.sowing, language).join(', ') : '–'),
    },
    {
      label: t('detail.goodNeighbors'),
      value: (p, nameOf) => p.goodNeighbors.map(nameOf).join(', ') || '–',
    },
    {
      label: t('detail.badNeighbors'),
      value: (p, nameOf) => p.badNeighbors.map(nameOf).join(', ') || '–',
    },
  ];
}

/** The request next to similar global plants, to spot duplicates and odd values. */
function Comparison({
  plant,
  similar,
  catalog,
}: {
  plant: Plant;
  similar: readonly Plant[];
  catalog: readonly CatalogPlant[];
}) {
  const { t } = useTranslation('admin');
  const { t: catalogT } = useTranslation('catalog');
  const { language } = useLanguage();
  const nameOf = (id: string) => catalog.find((p) => p.id === id)?.name ?? t('review.unknown');
  return (
    <section aria-labelledby="similar" className="flex flex-col gap-3">
      <h2 id="similar" className="text-lg font-semibold">
        {t('review.compare')}
      </h2>
      {similar.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('review.noSimilar')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="p-2 font-medium">
                  <span className="sr-only">{t('review.value')}</span>
                </th>
                <th scope="col" className="p-2 font-semibold">
                  {plant.name}{' '}
                  <span className="text-muted-foreground font-normal">{t('review.request')}</span>
                </th>
                {similar.map((other) => (
                  <th key={other.id} scope="col" className="p-2 font-medium">
                    <Link
                      to="/katalog/$plantId"
                      params={{ plantId: other.id }}
                      className="underline-offset-2 hover:underline"
                    >
                      {other.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows(catalogT, language).map(({ label, value }) => {
                const requested = value(plant, nameOf);
                return (
                  <tr key={label} className="border-t align-top">
                    <th scope="row" className="text-muted-foreground p-2 font-normal">
                      {label}
                    </th>
                    <td className="p-2 font-medium">{requested}</td>
                    {similar.map((other) => {
                      const shown = value(other, nameOf);
                      return (
                        <td
                          key={other.id}
                          className={shown === requested ? 'text-muted-foreground p-2' : 'p-2'}
                        >
                          {shown}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Reject({
  pending,
  onReject,
}: {
  pending: boolean;
  onReject: (comment: string) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const id = useId();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [failed, setFailed] = useState<unknown>(null);

  return (
    <section aria-labelledby="reject" className="flex max-w-2xl flex-col gap-3 border-t pt-6">
      <h2 id="reject" className="text-lg font-semibold">
        {t('review.reject')}
      </h2>
      {failed != null && <FormMessage tone="error">{apiErrorMessage(failed)}</FormMessage>}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{t('review.rejectReason')}</Label>
        <textarea
          id={id}
          rows={3}
          maxLength={500}
          value={comment}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          onChange={(event) => {
            setComment(event.target.value);
            setError(undefined);
          }}
          className="bg-card focus-visible:ring-ring/50 aria-invalid:border-red-600 rounded-md border px-3 py-2 text-base outline-none focus-visible:ring-[3px] md:text-sm"
        />
        {error ? (
          <p id={`${id}-error`} className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        ) : (
          <p id={`${id}-hint`} className="text-muted-foreground text-xs">
            {t('review.rejectHint')}
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11 self-start border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
        disabled={pending}
        onClick={() => {
          if (comment.trim() === '') {
            setError(t('review.rejectRequired'));
            return;
          }
          setFailed(null);
          void onReject(comment.trim()).catch((e: unknown) => {
            setFailed(e);
          });
        }}
      >
        {t('review.reject')}
      </Button>
    </section>
  );
}
