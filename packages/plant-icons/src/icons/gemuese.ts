import {
  around,
  circle,
  fill,
  leaf,
  line,
  oval,
  rotate,
  scallop,
  star,
  type IconShapes,
} from '../shapes';

// Shared greens so the set looks like one family.
const LEAF = '#3f8f2f';
const LEAF_LIGHT = '#7cc142';
const LEAF_DARK = '#2e6b2a';

/** Rocket leaf from (24, 46) in direction `angle` (degrees, 0 = up): midrib with paired lobes. */
function rucolaLeaf(angle: number): string {
  const a = (angle * Math.PI) / 180;
  const at = (along: number, side: number): [number, number] => [
    24 + along * Math.sin(a) + side * Math.cos(a),
    46 - along * Math.cos(a) + side * Math.sin(a),
  ];
  const lobe = (along: number, len: number, w: number, side: 1 | -1) => {
    const [x1, y1] = at(along, 0);
    const [x2, y2] = at(along + len * 0.6, side * len);
    return leaf(x1, y1, x2, y2, w);
  };
  const [tx, ty] = at(36, 0);
  const [bx, by] = at(24, 0);
  return [
    lobe(10, 6, 1.8, 1),
    lobe(10, 6, 1.8, -1),
    lobe(17, 7, 2.2, 1),
    lobe(17, 7, 2.2, -1),
    leaf(bx, by, tx, ty, 4.5),
    leaf(...at(4, 0), bx, by, 1.6),
  ].join('');
}

/** Three stalks with oval leaves on top, used for root and bulb crops. */
const sprigTop = (color: string, y = 18) => [
  line(color, 2.5, `M21 ${String(y)}L16 7M24 ${String(y)}V5M27 ${String(y)}L32 7`),
  fill(color, oval(15, 7, 3, 5, -30), oval(24, 5, 3, 5, 0), oval(33, 7, 3, 5, 30)),
];

export const gemueseIcons: Record<string, IconShapes> = {
  aubergine: [
    fill('#8a58b8', 'M31 15C41 21 42 37 32 42C22 47 10 40 13 29C15 22 23 12 31 15Z'),
    fill('#b893d8', oval(20, 31, 2.5, 6, 20)),
    fill(LEAF, leaf(25, 18, 37, 13, 3), leaf(29, 19, 34, 9, 2.5), 'M30 14L33 4L35 5L32 15Z'),
  ],

  blumenkohl: [
    fill('#4f9a35', leaf(24, 44, 5, 27, 6), leaf(24, 44, 43, 27, 6), leaf(24, 44, 24, 30, 6)),
    ...[
      [15, 24, 7],
      [33, 24, 7],
      [24, 19, 8],
      [19, 31, 7],
      [29, 31, 7],
    ].map(([x = 0, y = 0, r = 0]) => ({
      d: circle(x, y, r),
      fill: '#f3ecd4',
      stroke: '#a8996c',
      width: 1.5,
    })),
  ],

  brokkoli: [
    fill('#8cbf5a', 'M20 44L21 30L14 22L17 21L23 27L24 20L26 27L32 21L34 22L27 30L28 44Z'),
    ...[
      [14, 20, 7],
      [34, 20, 7],
      [24, 14, 8],
      [19, 25, 6],
      [29, 25, 6],
    ].map(([x = 0, y = 0, r = 0]) => ({
      d: scallop(x, y, r - 1, 1, 7),
      fill: '#2f7a3a',
      stroke: '#1f5528',
      width: 1.2,
    })),
  ],

  buschbohne: [
    line('#5aa83a', 6, 'M13 9C8 22 13 35 25 41'),
    line(LEAF, 6, 'M26 7C23 20 28 32 39 37'),
    fill(
      LEAF_DARK,
      circle(12, 22, 1.4),
      circle(16, 31, 1.4),
      circle(26, 20, 1.4),
      circle(31, 29, 1.4),
    ),
    line(LEAF_DARK, 2.5, 'M13 9L15 4M26 7L29 3'),
  ],

  chili: [
    fill(
      '#c62828',
      'M14 13C21 12 25 17 27 25C29 33 33 38 41 42C30 45 19 38 15 28C13 22 12 17 14 13Z',
    ),
    fill('#ef7a6e', oval(19, 24, 1.8, 5, -25)),
    fill(LEAF, leaf(9, 14, 21, 12, 3)),
    line(LEAF, 3, 'M15 12C13 8 15 5 19 4'),
  ],

  chinakohl: [
    {
      d: 'M15 43C9 30 12 13 24 4C36 13 39 30 33 43Z',
      fill: '#d4e8a6',
      stroke: '#5f9a3c',
      width: 1.6,
    },
    fill(
      '#8cbf5a',
      'M24 4C30 9 34 15 35 22C30 18 27 12 24 4ZM24 4C18 9 14 15 13 22C18 18 21 12 24 4Z',
    ),
    line('#5f9a3c', 1.6, 'M24 43V11M19 43C17 32 17 22 19 14M29 43C31 32 31 22 29 14'),
  ],

  endivie: [
    fill('#4f9a35', scallop(24, 26, 18, 2.5, 14)),
    fill('#8cc152', scallop(24, 26, 12, 2, 11, 10)),
    fill('#d6ea9c', scallop(24, 26, 6, 1.5, 8)),
  ],

  erbse: [
    fill('#4f9a35', leaf(7, 35, 41, 13, 8)),
    fill(LEAF_DARK, leaf(10, 33, 38, 15, 4.5)),
    fill(
      '#a5d65a',
      circle(15, 29, 3.2),
      circle(21, 25.3, 3.3),
      circle(27, 21.6, 3.3),
      circle(33, 18, 3),
    ),
  ],

  feldsalat: [
    ...around(6, -90, (a, x, y) => fill('#4f8a3c', oval(x, y, 9, 5, a)), 24, 25, 10),
    ...around(3, -60, (a, x, y) => fill('#7cb85a', oval(x, y, 6, 3.5, a)), 24, 25, 6),
  ],

  fenchel: [
    line('#8fb35a', 3, 'M20 25L15 9M24 23V6M28 25L33 9'),
    line(
      LEAF,
      1.5,
      'M15 9L11 5M15 9L13 3M15 9L18 4M24 6L21 2M24 6L27 2M33 9L36 4M33 9L37 6M33 9L31 3',
    ),
    {
      d: 'M11 35C11 25 17 22 24 22C31 22 37 25 37 35C37 42 30 45 24 45C18 45 11 42 11 35Z',
      fill: '#e6eec4',
      stroke: '#8fb35a',
      width: 1.6,
    },
    line('#8fb35a', 1.4, 'M24 24C20 30 20 38 23 44M24 24C28 30 28 38 25 44'),
  ],

  fruehlingszwiebel: [
    line('#4f9a35', 4, 'M22 30L15 4M24 30V3M26 30L33 5'),
    { d: 'M20 28H28V39C28 43 20 43 20 39Z', fill: '#f4f2e6', stroke: '#86ad5e', width: 1.6 },
    line('#86ad5e', 1.4, 'M22 42L20 46M24 42V46M26 42L28 46'),
  ],

  gruenkohl: [
    line('#8bbf6a', 3, 'M24 45V26M24 32L15 22M24 30L33 20'),
    fill(
      '#3a7d44',
      scallop(14, 18, 9, 1.8, 11),
      scallop(34, 16, 9, 1.8, 11),
      scallop(24, 24, 10, 2, 12, 15),
    ),
    line('#8bbf6a', 1.4, 'M24 33V17M14 23L13 12M34 21L35 10'),
  ],

  kartoffel: [
    fill('#a87a45', 'M8 27C8 17 20 11 31 13C42 15 43 30 35 36C27 42 8 38 8 27Z'),
    fill('#d9b47a', oval(22, 20, 6, 3, -15)),
    fill(
      '#6e4a26',
      circle(17, 27, 1.6),
      circle(29, 22, 1.6),
      circle(26, 32, 1.6),
      circle(36, 28, 1.4),
    ),
  ],

  knoblauch: [
    {
      d: 'M24 4C25 10 27 14 32 17C40 21 42 30 38 37C35 42 29 44 24 44C19 44 13 42 10 37C6 30 8 21 16 17C21 14 23 10 24 4Z',
      fill: '#f3eee2',
      stroke: '#958870',
      width: 1.6,
    },
    line('#958870', 1.4, 'M24 18C18 24 18 36 22 43M24 18C30 24 30 36 26 43'),
    fill('#c9a6c9', 'M24 4C25 9 26 12 28 15L20 15C22 12 23 9 24 4Z'),
  ],

  knollensellerie: [
    ...sprigTop('#5a9a3a', 20),
    {
      d: 'M9 31C9 22 17 19 24 19C31 19 39 22 39 31C39 39 32 43 24 43C16 43 9 39 9 31Z',
      fill: '#dccda0',
      stroke: '#957f4c',
      width: 1.6,
    },
    line('#957f4c', 1.4, 'M17 42L14 46M24 43V47M31 42L34 46M16 28L19 30M28 34L31 32M22 25L25 26'),
  ],

  kohlrabi: [
    line('#5a9a3a', 2.5, 'M19 22L13 9M24 19V6M29 22L35 9'),
    fill(LEAF, oval(12, 8, 3.5, 5.5, -25), oval(24, 5, 3.5, 5.5, 0), oval(36, 8, 3.5, 5.5, 25)),
    { d: circle(24, 31, 12), fill: '#b7d98b', stroke: '#5a9a3a', width: 1.6 },
    line('#5a9a3a', 2, 'M24 43V47M15 28L12 27M33 28L36 27'),
  ],

  kopfsalat: [
    ...around(7, -90, (a, x, y) => fill('#5a9f38', oval(x, y, 10, 7.5, a)), 24, 26, 10),
    fill('#b8e07a', circle(24, 26, 10)),
    line('#5a9f38', 1.6, 'M17 27C17 21 31 21 31 27M20 31C21 27 27 27 28 31'),
  ],

  kuerbis: [
    line('#5a7a2a', 4, 'M24 16C24 11 26 8 30 6'),
    ...[
      [15, 9],
      [33, 9],
      [24, 9.5],
    ].map(([x = 0, rx = 0]) => ({
      d: oval(x, 29, rx, 14, 90),
      fill: '#ec8a2c',
      stroke: '#b85c10',
      width: 1.6,
    })),
  ],

  lauch: [
    fill('#3f7f4a', leaf(24, 26, 9, 3, 4), leaf(24, 26, 39, 3, 4), leaf(24, 26, 24, 1, 3.5)),
    { d: 'M20 22H28V40C28 44 20 44 20 40Z', fill: '#eef0d8', stroke: '#7a9a4a', width: 1.6 },
    line('#7a9a4a', 1.4, 'M22 43L20 47M24 43V47M26 43L28 47'),
  ],

  mangold: [
    fill('#2e7d32', leaf(19, 27, 8, 4, 6.5), leaf(29, 27, 40, 4, 6.5), leaf(24, 25, 24, 2, 6.5)),
    line('#d8435f', 3, 'M20 45L19 27M28 45L29 27'),
    line('#d8435f', 1.4, 'M19 27L9 6M29 27L39 6'),
    line('#f2c230', 3, 'M24 45V25'),
    line('#f2c230', 1.4, 'M24 25V4'),
  ],

  moehre: [
    line(LEAF, 3, 'M22 13L16 3M24 13V2M26 13L32 3'),
    fill('#f08a24', 'M15 13C15 11 33 11 33 13C31 24 27 36 24 46C21 36 17 24 15 13Z'),
    line('#c25e0c', 1.4, 'M18 19H22M26 24H30M20 30H23M25 35H27'),
  ],

  paprika: [
    fill(
      '#e53935',
      'M12 18C12 12 18 11 24 13C30 11 36 12 36 18C38 28 36 40 30 42C27 43 25 41 24 40C23 41 21 43 18 42C12 40 10 28 12 18Z',
    ),
    line('#a81c1c', 1.6, 'M24 15V38'),
    line(LEAF, 3.5, 'M24 14C24 9 26 6 30 5'),
  ],

  pastinake: [
    line(LEAF, 3, 'M22 13L16 3M24 13V2M26 13L32 3'),
    {
      d: 'M14 13C14 11 34 11 34 13C32 24 27 36 24 46C21 36 16 24 14 13Z',
      fill: '#ece2b8',
      stroke: '#a48c4c',
      width: 1.6,
    },
    line('#a48c4c', 1.4, 'M18 19H22M26 24H30M20 30H23M25 35H27'),
  ],

  pfluecksalat: [
    fill('#b5523b', leaf(24, 44, 8, 12, 6), leaf(24, 44, 40, 12, 6)),
    fill('#8fbf4d', leaf(24, 44, 14, 6, 6.5), leaf(24, 44, 34, 6, 6.5), leaf(24, 44, 24, 4, 6)),
    line('#e2f0c0', 1.3, 'M24 43L14 7M24 43L34 7M24 43V6'),
  ],

  radicchio: [
    fill('#5a9a3a', leaf(24, 42, 6, 28, 5), leaf(24, 42, 42, 28, 5)),
    fill('#b83d66', circle(24, 25, 15)),
    line(
      '#f6e8ee',
      1.5,
      'M24 40C20 32 17 22 12 16M24 40V11M24 40C28 32 31 22 36 16M24 40C21 34 14 30 10 28M24 40C27 34 34 30 38 28',
    ),
  ],

  radieschen: [
    line(LEAF, 2.5, 'M22 21L17 9M26 21L31 9'),
    fill(LEAF, oval(16, 9, 4, 7, -20), oval(32, 9, 4, 7, 20)),
    fill('#f5efef', 'M21 38L24 47L27 38Z'),
    fill('#e0245e', circle(24, 30, 11)),
    fill('#f5efef', oval(19, 26, 2, 3.5, 25)),
  ],

  rettich: [
    line(LEAF, 2.5, 'M22 16L17 6M26 16L31 6'),
    fill(LEAF, oval(15, 6, 3.5, 6, -25), oval(33, 6, 3.5, 6, 25)),
    {
      d: 'M16 16C16 13 32 13 32 16C32 28 28 40 24 47C20 40 16 28 16 16Z',
      fill: '#f4f1e8',
      stroke: '#958870',
      width: 1.6,
    },
    line('#958870', 1.3, 'M19 22H23M25 28H29M21 34H24'),
  ],

  rhabarber: [
    line('#c0392b', 4, 'M17 45L13 20M24 45V18M31 45L35 20'),
    fill(LEAF, 'M5 18C4 7 16 2 24 6C32 2 44 7 43 18C42 25 33 24 24 20C15 24 6 25 5 18Z'),
    line(LEAF_LIGHT, 1.3, 'M24 19V8M24 18L13 10M24 18L35 10'),
  ],

  rosenkohl: [
    line('#8bbf6a', 5, 'M24 45V9'),
    fill('#8bbf6a', leaf(24, 10, 12, 4, 3), leaf(24, 10, 36, 4, 3)),
    ...[
      [18, 15, 5],
      [30, 19, 5],
      [18, 25, 5.5],
      [30, 30, 5.5],
      [18, 36, 5.5],
      [30, 40, 4.5],
    ].map(([x = 0, y = 0, r = 0]) => ({
      d: circle(x, y, r),
      fill: '#5a9a3a',
      stroke: LEAF_DARK,
      width: 1.3,
    })),
  ],

  'rote-bete': [
    line('#a8295a', 2, 'M22 21L14 7M26 21L34 7'),
    fill(LEAF, leaf(18, 15, 9, 3, 4.5), leaf(30, 15, 39, 3, 4.5)),
    fill('#a8295a', 'M11 28C11 19 37 19 37 28C37 38 29 41 24 47C19 41 11 38 11 28Z'),
    line('#d9668f', 1.4, 'M17 27C19 33 22 36 24 38M31 27C29 33 26 36 24 38'),
  ],

  rotkohl: [
    fill('#6a3a8a', oval(12, 35, 10, 6, -30), oval(36, 35, 10, 6, 30)),
    { d: circle(24, 25, 15), fill: '#8e4fb0', stroke: '#6a3a8a', width: 1.5 },
    line('#dcbde9', 1.5, 'M24 40C17 33 15 23 19 12M24 40C31 33 33 23 29 12M24 40V11'),
  ],

  rucola: [
    fill('#557a2e', rucolaLeaf(-28), rucolaLeaf(28), rucolaLeaf(0)),
    line('#a5c95b', 1.1, ...[-28, 28, 0].map((angle) => rotate('M24 45V12', angle, 24, 46))),
  ],

  salatgurke: [
    fill('#3e8e41', oval(24, 24, 20, 7, -40)),
    line('#8fcf6a', 1.4, 'M14 31C20 26 27 19 33 14M17 36C24 30 31 22 36 17'),
    fill(
      '#255c28',
      circle(17, 27, 1.1),
      circle(25, 23, 1.1),
      circle(30, 16, 1.1),
      circle(22, 32, 1.1),
      circle(32, 24, 1.1),
    ),
  ],

  schwarzwurzel: [
    line('#5a9a3a', 2.5, 'M24 10L17 2M24 10L31 2M24 10V1'),
    {
      d: 'M20 10C20 8 28 8 28 10C28 24 26 36 24 47C22 36 20 24 20 10Z',
      fill: '#4a3b2a',
      stroke: '#8a7350',
      width: 1.6,
    },
    line('#8a7350', 1.3, 'M21 18H24M24 26H27M22 33H24'),
  ],

  spinat: [
    fill('#2e7d32', leaf(24, 44, 10, 14, 7), leaf(24, 44, 38, 14, 7), leaf(24, 44, 24, 5, 7)),
    line(LEAF_LIGHT, 1.4, 'M24 43L11 15M24 43L37 15M24 43V7'),
  ],

  stangenbohne: [
    fill('#8b5e34', 'M22 3H26V46H22Z'),
    fill(LEAF, leaf(23, 12, 10, 8, 4), leaf(25, 22, 38, 18, 4), leaf(23, 32, 10, 28, 4)),
    line(LEAF_LIGHT, 3.5, 'M28 24C30 30 30 36 28 42M20 14C18 20 18 26 20 32'),
  ],

  staudensellerie: [
    fill(LEAF, scallop(14, 9, 5, 1.3, 7), scallop(24, 6, 5, 1.3, 7), scallop(34, 9, 5, 1.3, 7)),
    {
      d: 'M14 45L12 12L18 12L20 45ZM21 45V9H27V45ZM28 45L30 12L36 12L34 45Z',
      fill: '#a6cf72',
      stroke: '#5a9a3a',
      width: 1.4,
    },
    line('#5a9a3a', 1.2, 'M16 43L15 15M24 43V12M32 43L33 15'),
  ],

  tomate: [
    fill('#d63a2f', circle(24, 27, 16)),
    fill('#f07a6a', oval(17, 22, 3, 2, -30)),
    fill(LEAF, ...around(5, -90, (a, x, y) => leaf(24, 12, x, y, 2.2), 24, 12, 9)),
  ],

  weisskohl: [
    fill('#6a9a45', oval(12, 35, 10, 6, -30), oval(36, 35, 10, 6, 30)),
    { d: circle(24, 25, 15), fill: '#d4e6a5', stroke: '#6a9a45', width: 1.5 },
    line('#6a9a45', 1.5, 'M24 40C17 33 15 23 19 12M24 40C31 33 33 23 29 12'),
  ],

  wirsing: [
    fill('#3f7a35', scallop(12, 35, 9, 2, 9), scallop(36, 35, 9, 2, 9)),
    fill('#6a9a45', scallop(24, 25, 15, 1.6, 20)),
    line(
      '#bcd98f',
      1.3,
      'M15 22C17 20 19 22 21 20M27 20C29 22 31 20 33 22M17 30C19 28 21 30 23 28M25 30C27 28 29 30 31 28M20 36C22 34 24 36 26 34',
    ),
  ],

  zucchini: [
    fill('#3a7d34', oval(22, 27, 19, 7.5, -25)),
    line('#8fbf6a', 1.4, 'M8 32C16 30 26 26 34 21'),
    fill('#8fbf6a', 'M37 17L42 12L44 14L40 20Z'),
    fill('#f2c230', star(9, 35, 6, 2.5, 5)),
  ],

  zuckermais: [
    fill('#f4c430', oval(24, 22, 17, 8, 90)),
    line(
      '#c99a10',
      1.1,
      'M18 12H30M16.5 17H31.5M16 22H32M16.5 27H31.5M18 32H30M21 6V38M24 5V39M27 6V38',
    ),
    fill('#4f9a35', leaf(24, 46, 11, 14, 5), leaf(24, 46, 37, 14, 5)),
  ],

  zwiebel: [
    fill(
      '#b87a24',
      'M24 5C26 13 38 18 38 30C38 38 32 42 24 42C16 42 10 38 10 30C10 18 22 13 24 5Z',
    ),
    line(
      '#7e521a',
      1.3,
      'M24 10C18 18 16 30 20 41M24 10C30 18 32 30 28 41M20 43L18 46M24 43V47M28 43L30 46',
    ),
  ],
};
