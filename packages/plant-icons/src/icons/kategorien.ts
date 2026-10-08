import { fill, leaf, line, type IconShapes } from '../shapes';

/** Generic icons for own plants without a fitting plant icon. */
export const kategorieIcons: Record<string, IconShapes> = {
  'category-gemuese': [
    fill('#8b5e34', 'M4 42C8 34 16 31 24 31C32 31 40 34 44 42Z'),
    line('#3f8f2f', 3, 'M24 32V18'),
    fill('#3f8f2f', leaf(24, 20, 9, 11, 5), leaf(24, 18, 39, 7, 5.5)),
  ],

  'category-obst': [
    fill(
      '#d63a2f',
      'M24 15C30 10 41 13 41 25C41 37 32 44 28 43C26 43 25 42 24 42C23 42 22 43 20 43C16 44 7 37 7 25C7 13 18 10 24 15Z',
    ),
    line('#6b4a2a', 2.5, 'M24 16C24 11 23 8 21 5'),
    fill('#3f8f2f', leaf(24, 11, 35, 6, 3.5)),
  ],

  'category-kraut': [
    line('#3f7f2a', 2.4, 'M24 46V8'),
    fill(
      '#5aa83a',
      leaf(24, 40, 12, 32, 3.5),
      leaf(24, 40, 36, 32, 3.5),
      leaf(24, 29, 13, 21, 3.2),
      leaf(24, 29, 35, 21, 3.2),
      leaf(24, 18, 16, 10, 3),
      leaf(24, 18, 32, 10, 3),
      leaf(24, 10, 24, 2, 3),
    ),
  ],
};
