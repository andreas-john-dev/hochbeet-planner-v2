// 200 plantings over two seasons in a 6 × 3 m bed, for the performance test of the engine.
import type { Plant, Planting } from '@hochbeet/contracts';
import { bed as makeBed, plant as makePlant } from './test-utils';
const families = [
  'Kreuzblütler',
  'Korbblütler',
  'Doldenblütler',
  'Nachtschattengewächse',
  'Hülsenfrüchtler',
];
const feeders = ['STARK', 'MITTEL', 'SCHWACH'] as const;

/** 25 plants with neighbour lists, similar to the start catalogue. */
export const plants: Plant[] = Array.from({ length: 25 }, (_, i) =>
  makePlant(`p${String(i)}`, {
    family: families[i % families.length],
    feeder: feeders[i % feeders.length],
    spacingInRowCm: 15 + (i % 6) * 10,
    rowSpacingCm: 20 + (i % 5) * 10,
    lifecycle: { type: 'ANNUAL', cultureWeeks: 6 + (i % 10) },
    goodNeighbors: [`p${String((i + 3) % 25)}`, `p${String((i + 7) % 25)}`],
    badNeighbors: [`p${String((i + 5) % 25)}`],
  }),
);

/** 200 plantings in a 6 × 3 m bed over two seasons, singles and rows mixed, many overlaps. */
export const plantings: Planting[] = Array.from({ length: 200 }, (_, i): Planting => {
  const x = (i * 35) % 600;
  const y = (Math.floor(i / 17) * 25) % 300;
  const week = (i * 3) % 70;
  const startDate = new Date(Date.UTC(2026, 2, 2 + week * 7)).toISOString().slice(0, 10);
  const common = {
    id: `pl${String(i).padStart(3, '0')}`,
    bedId: 'bed',
    plantId: `p${String(i % 25)}`,
    x,
    y,
    startDate,
    endDate: null,
    removedDate: null,
  };
  return i % 3 === 0
    ? { ...common, kind: 'ROW', orientation: i % 2 ? 'H' : 'V', lengthCm: 60 + (i % 4) * 30 }
    : { ...common, kind: 'SINGLE' };
});

export const bed = makeBed({ widthCm: 600, depthCm: 300 });
