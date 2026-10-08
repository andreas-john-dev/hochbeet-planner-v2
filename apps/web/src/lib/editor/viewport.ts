/**
 * Viewport of the bed editor: the SVG works in cm, the screen in px. `x`/`y` is the cm
 * position at the top-left corner of the view, `scale` the number of px per cm.
 */
export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Zoom limits: from a whole 20 m bed on a phone down to single 5 cm cells. */
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 40;

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/** Shows the whole bed, centred, with `marginPx` of space around it. */
export function fitToBed(
  bed: { widthCm: number; depthCm: number },
  size: Size,
  marginPx = 24,
): Viewport {
  const scale = clampScale(
    Math.min((size.width - 2 * marginPx) / bed.widthCm, (size.height - 2 * marginPx) / bed.depthCm),
  );
  return {
    scale,
    x: bed.widthCm / 2 - size.width / scale / 2,
    y: bed.depthCm / 2 - size.height / scale / 2,
  };
}

/** Zooms by `factor` and keeps the cm point under the screen point `at` (px) in place. */
export function zoomAt(viewport: Viewport, factor: number, at: Point): Viewport {
  const scale = clampScale(viewport.scale * factor);
  const cmX = viewport.x + at.x / viewport.scale;
  const cmY = viewport.y + at.y / viewport.scale;
  return { scale, x: cmX - at.x / scale, y: cmY - at.y / scale };
}

/** Moves the content by a screen distance in px (dragging to the right shows more on the left). */
export function panBy(viewport: Viewport, dxPx: number, dyPx: number): Viewport {
  return {
    ...viewport,
    x: viewport.x - dxPx / viewport.scale,
    y: viewport.y - dyPx / viewport.scale,
  };
}

/** The SVG viewBox for a viewport shown at `size`. */
export function viewBox(viewport: Viewport, size: Size): string {
  const r = (n: number) => String(Math.round(n * 100) / 100);
  return `${r(viewport.x)} ${r(viewport.y)} ${r(size.width / viewport.scale)} ${r(size.height / viewport.scale)}`;
}

/** Converts a screen point (px, relative to the SVG) to bed coordinates in cm. */
export const toCm = (viewport: Viewport, at: Point): Point => ({
  x: viewport.x + at.x / viewport.scale,
  y: viewport.y + at.y / viewport.scale,
});

/**
 * Grid lines for a zoom level: the fine 5 cm grid once its cells are at least 8 px wide,
 * otherwise a coarser one; major lines every metre (or 50 cm when zoomed in).
 */
export function gridSteps(scale: number): { minor: number; major: number } {
  const minor = [5, 10, 25, 50, 100].find((step) => step * scale >= 8) ?? 100;
  return { minor, major: minor <= 10 ? 50 : 100 };
}
