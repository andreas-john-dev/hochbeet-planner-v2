import { around, circle, fill, leaf, line, oval, scallop, type IconShapes } from '../shapes';

/** Pairs of leaves along a vertical stem at x = 24, from y = 40 upwards. */
function leafPairs(color: string, ys: readonly number[], len: number, w: number) {
  return fill(
    color,
    ...ys.flatMap((y, i) => {
      const l = len * (1 - i * 0.12);
      return [leaf(24, y, 24 - l, y - l * 0.55, w), leaf(24, y, 24 + l, y - l * 0.55, w)];
    }),
  );
}

export const kraeuterIcons: Record<string, IconShapes> = {
  basilikum: [
    line('#2e7d32', 2.5, 'M24 46V18'),
    fill('#43a047', oval(15, 30, 7, 11, -40), oval(33, 30, 7, 11, 40), oval(24, 13, 6, 9, 0)),
    line('#2e7d32', 1.3, 'M23 37L10 23M25 37L38 23M24 21V6'),
  ],

  bohnenkraut: [
    line('#6b7a3a', 2, 'M24 46V6M24 34L14 20M24 28L34 14'),
    fill(
      '#7d9a5b',
      leaf(24, 40, 17, 36, 1.6),
      leaf(24, 40, 31, 36, 1.6),
      leaf(24, 22, 19, 16, 1.5),
      leaf(24, 22, 29, 16, 1.5),
      leaf(24, 12, 21, 6, 1.4),
      leaf(24, 12, 27, 6, 1.4),
      leaf(18, 25, 11, 25, 1.5),
      leaf(16, 22, 15, 15, 1.5),
      leaf(31, 18, 38, 17, 1.5),
      leaf(32, 16, 32, 9, 1.5),
    ),
  ],

  dill: [
    line(
      '#5a9a3a',
      1.6,
      'M24 46V18M24 30L12 22M24 34L36 26M12 22L8 18M12 22L11 16M36 26L40 22M36 26L37 20',
    ),
    line(
      '#5a9a3a',
      1.1,
      ...around(7, 200, (_, x, y) => `M24 18L${x.toFixed(1)} ${y.toFixed(1)}`, 24, 18, 11),
    ),
    fill('#e6c229', ...around(7, 200, (_, x, y) => circle(x, y, 2.4), 24, 18, 11)),
  ],

  kapuzinerkresse: [
    fill('#4f9a35', circle(17, 29, 12)),
    line(
      '#c5e08a',
      1.3,
      ...around(7, 0, (_, x, y) => `M17 29L${x.toFixed(1)} ${y.toFixed(1)}`, 17, 29, 10),
    ),
    fill('#f57c00', ...around(5, -90, (a, x, y) => oval(x, y, 5, 3.5, a), 33, 14, 5)),
  ],

  koriander: [
    line('#4c7f2c', 1.8, 'M24 46V30M24 38L13 27M24 34L35 22M24 30V15'),
    fill(
      '#6b9e3f',
      ...[
        [12, 23],
        [36, 18],
        [24, 11],
      ].flatMap(([x = 0, y = 0]) => around(3, -90, (_, cx, cy) => circle(cx, cy, 4), x, y, 4)),
    ),
  ],

  oregano: [
    line('#5a7040', 1.8, 'M18 46L16 12M30 46L32 14'),
    leafPairs('#6d8b4a', [40, 32, 24], 6, 2.5),
    fill(
      '#6d8b4a',
      oval(12, 38, 3, 2, -30),
      oval(21, 38, 3, 2, 30),
      oval(12, 29, 3, 2, -30),
      oval(21, 29, 3, 2, 30),
      oval(28, 36, 3, 2, -30),
      oval(36, 36, 3, 2, 30),
    ),
    fill('#c27ba0', circle(16, 10, 3.5), circle(32, 12, 3.5), circle(24, 14, 3)),
  ],

  petersilie: [
    line('#2e6b2e', 1.8, 'M24 46V28M24 40L14 24M24 38L34 22M24 28V14'),
    fill(
      '#388e3c',
      scallop(13, 19, 7, 1.6, 9),
      scallop(35, 17, 7, 1.6, 9),
      scallop(24, 11, 7.5, 1.6, 9, 20),
    ),
  ],

  pfefferminze: [
    line('#1f6f63', 2.2, 'M24 46V6'),
    leafPairs('#1f9a8a', [42, 30, 18], 12, 4),
    line(
      '#a7e3d8',
      1.1,
      'M24 42L13 36M24 42L35 36M24 30L14 25M24 30L34 25M24 18L16 14M24 18L32 14',
    ),
  ],

  rosmarin: [
    line('#7a5a3a', 2.5, 'M12 44L36 6'),
    fill(
      '#5c7c6a',
      ...Array.from({ length: 7 }, (_, i) => {
        const x = 14 + i * 3.2;
        const y = 41 - i * 5.1;
        return leaf(x, y, x - 7, y - 3, 1.3) + leaf(x, y, x + 5, y + 5, 1.3);
      }),
    ),
    fill('#7fa7e0', circle(33, 14, 2), circle(36, 9, 2)),
  ],

  salbei: [
    line('#5f776f', 2.5, 'M24 46V20'),
    fill('#7a948b', oval(15, 28, 6, 12, -35), oval(33, 28, 6, 12, 35), oval(24, 13, 6, 11, 0)),
    line('#c9d8d2', 1.3, 'M23 36L9 19M25 36L39 19M24 22V4'),
  ],

  schnittlauch: [
    line('#4f9a35', 2.4, 'M24 46L16 8M24 46L21 6M24 46L27 6M24 46L32 8M24 46L36 12'),
    fill('#9c6ade', circle(29, 9, 5)),
    line('#c9a8f0', 1.2, 'M26 7L32 11M29 5V13M32 7L26 11'),
  ],

  thymian: [
    line('#7a6a4a', 1.6, 'M24 46V20M24 38L12 24M24 34L36 22M24 28L18 14M24 26L31 12'),
    fill(
      '#7f9168',
      ...[
        [12, 24],
        [15, 28],
        [18, 31],
        [36, 22],
        [33, 26],
        [30, 29],
        [18, 14],
        [20, 19],
        [31, 12],
        [28, 17],
        [24, 20],
        [24, 40],
      ].flatMap(([x = 0, y = 0]) => [
        oval(x - 2.2, y, 2.2, 1.3, -20),
        oval(x + 2.2, y, 2.2, 1.3, 20),
      ]),
    ),
  ],
};
