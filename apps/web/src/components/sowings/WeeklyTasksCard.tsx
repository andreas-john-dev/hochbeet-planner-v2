import { DEFAULT_LAST_FROST } from '@hochbeet/contracts';
import { weekStart } from '@hochbeet/garden-rules';
import { Link } from '@tanstack/react-router';
import { ShoppingBasket, Shovel, Sprout, TriangleAlert } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormMessage } from '@/components/FormField';
import { Card } from '@/components/ui/card';
import { SkeletonList } from '@/components/ui/skeleton';
import { apiErrorMessage } from '@/lib/api';
import {
  useAllPlantings,
  useGardenSettings,
  usePlants,
  useSaveSowing,
  useSowings,
} from '@/lib/garden';
import { useLanguage } from '@/lib/i18n';
import { weekText } from '@/lib/sowings';
import { cn } from '@/lib/utils';
import {
  isSowingTask,
  newTasks,
  nextWeek,
  taskDetail,
  taskDone,
  taskTitle,
  weeklyTasks,
  type BedTask,
  type SowingTask,
} from '@/lib/weekly-tasks';

type Shown = 'this' | 'next';

const VIEWS: readonly Shown[] = ['this', 'next'];

/** Tasks the compact card shows before pointing to the raising page. */
const COMPACT_LIMIT = 4;

/**
 * „Aufgaben“ of this or the next week from batches and beds, never stored. Batch tasks are
 * checked off here and move the batch on; bed tasks open the editor on their week. The
 * next week shows only what newly comes up then. `compact` (bed overview) leaves out the
 * details and shows the first few tasks, those in the beds first.
 */
export function WeeklyTasksCard({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('sowings');
  const garden = useAllPlantings();
  const plants = usePlants();
  const sowings = useSowings();
  const lastFrost = useGardenSettings().data?.lastFrost ?? DEFAULT_LAST_FROST;
  const [thisWeek] = useState(() => weekStart(new Date()));
  const [shown, setShown] = useState<Shown>('this');
  const week = shown === 'this' ? thisWeek : nextWeek(thisWeek);
  const titleId = useId();

  const tasks = useMemo(() => {
    if (!garden.beds || !garden.plantings || !plants.data || !sowings.data) return undefined;
    const all = weeklyTasks(week, {
      beds: garden.beds,
      plantings: garden.plantings,
      sowings: sowings.data,
      plants: plants.data,
      lastFrost,
    });
    return shown === 'this' ? all : newTasks(all, week);
  }, [garden.beds, garden.plantings, plants.data, sowings.data, lastFrost, week, shown]);
  const error = garden.error ?? plants.error ?? sowings.error;
  // In the bed overview the beds come first.
  const listed =
    tasks && compact
      ? [...tasks.filter((t) => !isSowingTask(t)), ...tasks.filter(isSowingTask)].slice(
          0,
          COMPACT_LIMIT,
        )
      : tasks;
  const more = (tasks?.length ?? 0) - (listed?.length ?? 0);

  return (
    <Card
      role="region"
      aria-labelledby={titleId}
      data-testid="weekly-tasks"
      className={cn('flex flex-col gap-3', compact ? 'p-4' : 'p-4 md:p-5')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id={titleId} className="text-lg font-semibold">
            {t('tasks.title')}
          </h2>
          <p className="text-muted-foreground text-sm">{weekText(week)}</p>
        </div>
        <div
          role="group"
          aria-label={t('tasks.week')}
          className="bg-muted flex w-fit gap-1 rounded-lg p-1"
        >
          {VIEWS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={shown === value}
              onClick={() => {
                setShown(value);
              }}
              className={cn(
                'focus-visible:ring-ring/50 h-11 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] md:h-9',
                shown === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {value === 'this' ? t('tasks.thisWeek') : t('tasks.nextWeek')}
            </button>
          ))}
        </div>
      </div>

      {error && <FormMessage tone="error">{apiErrorMessage(error)}</FormMessage>}
      {!error && !listed && (
        <SkeletonList
          label={t('tasks.loading')}
          count={2}
          className="grid gap-2"
          itemClassName="h-10 rounded-md"
        />
      )}
      {listed?.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {shown === 'this' ? t('tasks.emptyThis') : t('tasks.emptyNext')}
        </p>
      )}
      {listed && listed.length > 0 && (
        <ul className="flex flex-col divide-y">
          {listed.map((task) =>
            isSowingTask(task) ? (
              <SowingTaskItem key={task.key} task={task} compact={compact} />
            ) : (
              <BedTaskItem key={task.key} task={task} compact={compact} />
            ),
          )}
        </ul>
      )}
      {more > 0 && (
        <Link
          to="/anzucht"
          className="text-primary w-fit text-sm font-medium underline underline-offset-4"
        >
          {t('tasks.more', { count: more })}
        </Link>
      )}
    </Card>
  );
}

function Overdue({ id }: { id?: string }) {
  const { t } = useTranslation('sowings');
  return (
    <span
      id={id}
      className="flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300"
    >
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
      {t('tasks.overdue')}
    </span>
  );
}

function SowingTaskItem({ task, compact }: { task: SowingTask; compact: boolean }) {
  const { language } = useLanguage();
  const save = useSaveSowing();
  const done = save.isPending || save.isSuccess;
  const id = useId();
  const described = [task.overdue && `${id}-late`, !compact && `${id}-detail`].filter(Boolean);
  return (
    <li data-task={task.key} className="flex flex-col gap-1 py-1.5">
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        {/* Named by the task alone; the overdue mark and the details describe it. */}
        <input
          type="checkbox"
          className="accent-primary size-5 shrink-0"
          aria-labelledby={`${id}-title`}
          aria-describedby={described.length > 0 ? described.join(' ') : undefined}
          checked={done}
          disabled={done}
          onChange={() => {
            save.mutate({ id: task.sowing.id, fields: taskDone(task) });
          }}
        />
        <span className="flex min-w-0 flex-col">
          <span className="flex flex-wrap items-center gap-x-2 font-medium">
            <span id={`${id}-title`}>{taskTitle(task, language)}</span>
            {task.overdue && <Overdue id={`${id}-late`} />}
          </span>
          {!compact && (
            <span id={`${id}-detail`} className="text-muted-foreground text-sm">
              {taskDetail(task, language)}
            </span>
          )}
        </span>
      </label>
      {save.error && (
        <span role="alert" className="pl-8 text-xs text-red-700 dark:text-red-400">
          {apiErrorMessage(save.error)}
        </span>
      )}
    </li>
  );
}

const BED_ICON = { PLANT_OUT: Shovel, DIRECT_SOW: Sprout, SET_PLANTS: ShoppingBasket };

function BedTaskItem({ task, compact }: { task: BedTask; compact: boolean }) {
  const { language } = useLanguage();
  const Icon = BED_ICON[task.kind];
  return (
    <li data-task={task.key} className="flex min-h-11 items-center gap-3 py-1.5">
      <Icon className="text-primary size-5 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <Link
          to="/beete/$bedId"
          params={{ bedId: task.bed.id }}
          search={{ woche: task.since }}
          className="font-medium underline-offset-4 hover:underline"
        >
          {taskTitle(task, language)}
        </Link>
        {!compact && (
          <span className="text-muted-foreground text-sm">{taskDetail(task, language)}</span>
        )}
      </span>
    </li>
  );
}
