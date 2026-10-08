import type { ReactNode } from 'react';
import type { Category } from '@hochbeet/contracts';
import { seedPlants } from '@hochbeet/catalog-seed';
import { CATEGORY_ICONS } from '@hochbeet/plant-icons';
import { IconSvg, PlantIcon } from '@hochbeet/plant-icons/react';
import { Link } from '@tanstack/react-router';
import { Logo } from '@/components/layout/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const SIZES = [24, 32, 48] as const;

const SECTIONS: { category: Category; title: string; fallback: string }[] = [
  { category: 'GEMUESE', title: 'Gemüse', fallback: 'Eigenes Gemüse' },
  { category: 'OBST', title: 'Obst', fallback: 'Eigenes Obst' },
  { category: 'KRAUT', title: 'Kräuter', fallback: 'Eigenes Kraut' },
];

function Tile({ name, children }: { name: string; children: (size: number) => ReactNode }) {
  return (
    <li className="bg-card flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-end gap-3">
        {SIZES.map((size) => (
          <span key={size}>{children(size)}</span>
        ))}
      </div>
      <span className="text-sm">{name}</span>
    </li>
  );
}

const gridClass = 'grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3';

/** Developer page: all plant icons in 24, 32 and 48 px. Public, no data needed. */
export function IconGalleryPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between px-4 md:px-8">
        <Link to="/">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-2 pb-12 md:px-8">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Icon-Galerie</h1>
          <p className="text-muted-foreground">
            Alle Pflanzen-Icons in 24, 32 und 48 px, dazu die Kategorie-Icons für eigene Sorten.
          </p>
        </div>
        {SECTIONS.map(({ category, title }) => (
          <section key={category} className="mb-8" aria-labelledby={`icons-${category}`}>
            <h2 id={`icons-${category}`} className="mb-3 text-lg font-semibold">
              {title}
            </h2>
            <ul className={gridClass}>
              {seedPlants
                .filter((plant) => plant.category === category)
                .map((plant) => (
                  <Tile key={plant.id} name={plant.name}>
                    {(size) => <PlantIcon plant={plant} size={size} />}
                  </Tile>
                ))}
            </ul>
          </section>
        ))}
        <section aria-labelledby="icons-fallback">
          <h2 id="icons-fallback" className="mb-3 text-lg font-semibold">
            Kategorie-Icons
          </h2>
          <ul className={gridClass}>
            {SECTIONS.map(({ category, fallback }) => (
              <Tile key={category} name={fallback}>
                {(size) => <IconSvg icon={CATEGORY_ICONS[category]} size={size} label={fallback} />}
              </Tile>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
