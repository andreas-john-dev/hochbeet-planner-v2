import type { Category } from '@hochbeet/contracts';
import { gemueseIcons } from './icons/gemuese';
import { kategorieIcons } from './icons/kategorien';
import { kraeuterIcons } from './icons/kraeuter';
import { obstIcons } from './icons/obst';
import type { IconShapes } from './shapes';

export type { IconShapes, Shape } from './shapes';

/** Fallback icon keys per plant category, used for custom plants without their own icon. */
export const CATEGORY_ICONS = {
  GEMUESE: 'category-gemuese',
  OBST: 'category-obst',
  KRAUT: 'category-kraut',
} as const satisfies Record<Category, string>;

/** All icons by key, drawn on a 48 × 48 grid. */
export const ICONS: Readonly<Record<string, IconShapes>> = {
  ...gemueseIcons,
  ...obstIcons,
  ...kraeuterIcons,
  ...kategorieIcons,
};

/** Plant icon keys without the category fallbacks, sorted; for the icon picker. */
export const PLANT_ICON_KEYS: readonly string[] = Object.keys(ICONS)
  .filter((key) => !key.startsWith('category-'))
  .sort();

export const ICON_VIEWBOX = '0 0 48 48';

export const hasIcon = (key: string): boolean => Object.hasOwn(ICONS, key);

/** The icon a plant shows: its own if it exists, otherwise its category's fallback. */
export function resolveIconKey(plant: { icon: string; category: Category }): string {
  return hasIcon(plant.icon) ? plant.icon : CATEGORY_ICONS[plant.category];
}
