import type { Plant } from '@hochbeet/contracts';
import { CATEGORY_ICONS, ICON_VIEWBOX, ICONS, resolveIconKey } from './index';

export interface IconSvgProps {
  /** Icon key, e.g. `tomate` or `category-kraut`. */
  icon: string;
  /** Edge length in px. */
  size?: number;
  /** Accessible name; without it the icon is decorative. */
  label?: string;
  className?: string;
}

/** Renders one icon by key. Unknown keys fall back to the vegetable icon. */
export function IconSvg({ icon, size = 24, label, className }: IconSvgProps) {
  const shapes = ICONS[icon] ?? ICONS[CATEGORY_ICONS.GEMUESE] ?? [];
  return (
    <svg
      viewBox={ICON_VIEWBOX}
      width={size}
      height={size}
      className={className}
      data-icon={icon}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {shapes.map((shape, i) => (
        <path
          // Shapes are static and never reordered.
          key={i}
          d={shape.d}
          fill={shape.fill ?? 'none'}
          stroke={shape.stroke}
          strokeWidth={shape.width}
          strokeLinecap={shape.stroke ? 'round' : undefined}
          strokeLinejoin={shape.stroke ? 'round' : undefined}
        />
      ))}
    </svg>
  );
}

export interface PlantIconProps extends Omit<IconSvgProps, 'icon' | 'label'> {
  plant: Pick<Plant, 'icon' | 'category' | 'name'>;
  /** Hide from assistive technology when the name is shown next to the icon. */
  decorative?: boolean;
}

/** Icon of a plant, with the category icon as fallback; labelled with the plant name. */
export function PlantIcon({ plant, decorative = false, ...props }: PlantIconProps) {
  return (
    <IconSvg icon={resolveIconKey(plant)} label={decorative ? undefined : plant.name} {...props} />
  );
}
