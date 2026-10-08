import type { CatalogPlant, Category } from '@hochbeet/contracts';
import { CATEGORY_ICONS, PLANT_ICON_KEYS } from '@hochbeet/plant-icons';
import { IconSvg } from '@hochbeet/plant-icons/react';
import { useId } from 'react';
import { CATEGORY_LABEL } from '@/lib/catalog';
import { cn } from '@/lib/utils';

/**
 * Picks the icon of an own plant from packages/plant-icons; the first choice is the category
 * icon, which follows the category. Native radio buttons, so arrow keys work.
 */
export function IconPicker({
  value,
  category,
  catalog,
  onChange,
}: {
  value: string | null;
  category: Category;
  catalog: readonly CatalogPlant[];
  onChange: (icon: string | null) => void;
}) {
  const name = useId();
  const nameOf = new Map(
    catalog.filter((p) => p.source === 'GLOBAL').map((p) => [p.icon, p.name] as const),
  );
  const options = [
    {
      key: null,
      icon: CATEGORY_ICONS[category],
      label: `Kategorie-Icon (${CATEGORY_LABEL[category]})`,
    },
    ...PLANT_ICON_KEYS.map((key) => ({ key, icon: key, label: nameOf.get(key) ?? key })),
  ];

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Icon</legend>
      <div className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1 overflow-y-auto rounded-lg border p-2">
        {options.map((option) => {
          const checked = option.key === value;
          return (
            <label
              key={option.key ?? 'category'}
              title={option.label}
              className={cn(
                'has-focus-visible:ring-ring/50 grid size-12 cursor-pointer place-items-center rounded-md border border-transparent has-focus-visible:ring-[3px]',
                checked ? 'border-primary bg-secondary' : 'hover:bg-accent',
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                aria-label={option.label}
                checked={checked}
                onChange={() => {
                  onChange(option.key);
                }}
              />
              <IconSvg icon={option.icon} size={32} />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
