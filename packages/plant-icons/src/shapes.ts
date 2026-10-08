/**
 * Building blocks for the 48 × 48 icons. Every icon is a list of shapes,
 * drawn in order: filled areas (`fill`), lines (`stroke` + `width`) or both.
 */
export interface Shape {
  d: string;
  fill?: string;
  stroke?: string;
  width?: number;
}

export type IconShapes = readonly Shape[];

const r1 = (n: number) => String(Math.round(n * 10) / 10);
const pt = (x: number, y: number) => `${r1(x)} ${r1(y)}`;
const rad = (deg: number) => (deg * Math.PI) / 180;

export const circle = (cx: number, cy: number, r: number) =>
  `M${pt(cx - r, cy)}A${r1(r)} ${r1(r)} 0 1 0 ${pt(cx + r, cy)}A${r1(r)} ${r1(r)} 0 1 0 ${pt(cx - r, cy)}Z`;

/** Ellipse rotated by `angle` degrees around its centre. */
export function oval(cx: number, cy: number, rx: number, ry: number, angle = 0): string {
  const dx = rx * Math.cos(rad(angle));
  const dy = rx * Math.sin(rad(angle));
  const arc = `A${r1(rx)} ${r1(ry)} ${r1(angle)} 0 1`;
  return `M${pt(cx - dx, cy - dy)}${arc} ${pt(cx + dx, cy + dy)}${arc} ${pt(cx - dx, cy - dy)}Z`;
}

/** Pointed leaf from (x1, y1) to (x2, y2), `w` wide on each side of the midrib. */
export function leaf(x1: number, y1: number, x2: number, y2: number, w: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = (-(y2 - y1) / len) * 2 * w;
  const ny = ((x2 - x1) / len) * 2 * w;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return `M${pt(x1, y1)}Q${pt(mx + nx, my + ny)} ${pt(x2, y2)}Q${pt(mx - nx, my - ny)} ${pt(x1, y1)}Z`;
}

/** Circle with `n` round bulges, e.g. for curly leaves or florets. */
export function scallop(cx: number, cy: number, r: number, depth: number, n: number, rot = 0) {
  const at = (radius: number, i: number) => {
    const a = rad(rot) + (i * 2 * Math.PI) / n;
    return pt(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
  };
  let d = `M${at(r - depth, 0)}`;
  for (let i = 0; i < n; i++) d += `Q${at(r + depth, i + 0.5)} ${at(r - depth, i + 1)}`;
  return `${d}Z`;
}

/** Star with `n` points, the first one pointing up. */
export function star(cx: number, cy: number, outer: number, inner: number, n: number) {
  const points = Array.from({ length: 2 * n }, (_, i) => {
    const a = rad(-90 + (i * 180) / n);
    const radius = i % 2 === 0 ? outer : inner;
    return pt(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
  });
  return `M${points.join('L')}Z`;
}

/** `count` items evenly spaced around a centre, starting at `start` degrees. */
export function around<T>(
  count: number,
  start: number,
  make: (angle: number, x: number, y: number) => T,
  cx = 0,
  cy = 0,
  dist = 0,
): T[] {
  return Array.from({ length: count }, (_, i) => {
    const a = start + (i * 360) / count;
    return make(a, cx + dist * Math.cos(rad(a)), cy + dist * Math.sin(rad(a)));
  });
}

export const fill = (color: string, ...paths: string[]): Shape => ({
  d: paths.join(''),
  fill: color,
});
export const line = (color: string, width: number, ...paths: string[]): Shape => ({
  d: paths.join(''),
  stroke: color,
  width,
});

/** Rotates a path made of absolute M/L/V/H/Z commands around (cx, cy). */
export function rotate(d: string, deg: number, cx: number, cy: number): string {
  const a = (deg * Math.PI) / 180;
  const turn = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    const rx = cx + dx * Math.cos(a) - dy * Math.sin(a);
    const ry = cy + dx * Math.sin(a) + dy * Math.cos(a);
    return `${String(Math.round(rx * 10) / 10)} ${String(Math.round(ry * 10) / 10)}`;
  };
  let x = 0;
  let y = 0;
  return d.replace(/([MLVHZ])([^MLVHZ]*)/g, (_, cmd: string, args: string) => {
    const n = args
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (cmd === 'Z') return 'Z';
    if (cmd === 'V') y = n[0] ?? y;
    else if (cmd === 'H') x = n[0] ?? x;
    else {
      x = n[0] ?? x;
      y = n[1] ?? y;
    }
    return `${cmd === 'M' ? 'M' : 'L'}${turn(x, y)}`;
  });
}
