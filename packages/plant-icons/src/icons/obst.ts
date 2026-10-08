import { around, circle, fill, leaf, type IconShapes } from '../shapes';

export const obstIcons: Record<string, IconShapes> = {
  erdbeere: [
    fill(
      '#e0245e',
      'M24 45C14 39 8 29 10 21C12 15 18 14 24 16C30 14 36 15 38 21C40 29 34 39 24 45Z',
    ),
    fill(
      '#f7d14a',
      ...[
        [17, 22],
        [24, 21],
        [31, 22],
        [15, 29],
        [21, 28],
        [27, 28],
        [33, 29],
        [19, 35],
        [24, 34],
        [29, 35],
        [24, 40],
      ].map(([x = 0, y = 0]) => circle(x, y, 1)),
    ),
    fill('#3f8f2f', ...around(5, -90, (_, x, y) => leaf(24, 16, x, y, 2.4), 24, 16, 9)),
  ],
};
