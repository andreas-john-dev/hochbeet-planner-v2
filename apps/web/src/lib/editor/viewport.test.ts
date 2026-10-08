import { describe, expect, it } from 'vitest';
import { fitToBed, gridSteps, MAX_SCALE, panBy, toCm, viewBox, zoomAt } from './viewport';

describe('viewport', () => {
  const size = { width: 448, height: 248 };

  it('fits a 2 × 1 m bed centred into the drawing area', () => {
    const vp = fitToBed({ widthCm: 200, depthCm: 100 }, size, 24);
    expect(vp.scale).toBe(2); // (448 - 48) / 200
    expect(toCm(vp, { x: 24, y: 24 })).toEqual({ x: 0, y: 0 });
    expect(toCm(vp, { x: 224, y: 124 })).toEqual({ x: 100, y: 50 });
  });

  it('keeps the point under the cursor when zooming', () => {
    const vp = fitToBed({ widthCm: 200, depthCm: 100 }, size);
    const at = { x: 300, y: 100 };
    const before = toCm(vp, at);
    const zoomed = zoomAt(vp, 2.5, at);
    expect(zoomed.scale).toBe(5);
    const after = toCm(zoomed, at);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('limits the zoom', () => {
    expect(zoomAt({ x: 0, y: 0, scale: 30 }, 10, { x: 0, y: 0 }).scale).toBe(MAX_SCALE);
  });

  it('pans with the finger', () => {
    expect(panBy({ x: 10, y: 10, scale: 2 }, 20, -10)).toEqual({ x: 0, y: 15, scale: 2 });
  });

  it('builds the SVG viewBox in cm', () => {
    expect(viewBox({ x: -12, y: -24, scale: 2 }, size)).toBe('-12 -24 224 124');
  });

  it('shows the 5 cm grid only when cells are large enough', () => {
    expect(gridSteps(2)).toEqual({ minor: 5, major: 50 });
    expect(gridSteps(1)).toEqual({ minor: 10, major: 50 });
    expect(gridSteps(0.5)).toEqual({ minor: 25, major: 100 });
    expect(gridSteps(0.05)).toEqual({ minor: 100, major: 100 });
  });
});
