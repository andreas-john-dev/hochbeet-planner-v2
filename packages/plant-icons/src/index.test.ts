import { seedPlants } from '@hochbeet/catalog-seed';
import { describe, expect, it } from 'vitest';
import { CATEGORY_ICONS, hasIcon, ICONS, PLANT_ICON_KEYS, resolveIconKey } from './index';

const colorsOf = (key: string) =>
  new Set((ICONS[key] ?? []).flatMap((s) => [s.fill, s.stroke]).filter((c) => c !== undefined));

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};
// Page backgrounds of apps/web in light and dark mode (--background).
const LIGHT_BG = '#fafaf6';
const DARK_BG = '#121a14';

describe('plant icons', () => {
  it('has an icon for every seed plant', () => {
    const missing = seedPlants.filter((p) => !hasIcon(p.icon)).map((p) => p.name);
    expect(missing).toEqual([]);
  });

  it('has no icons without a seed plant', () => {
    expect(PLANT_ICON_KEYS).toEqual(seedPlants.map((p) => p.icon).sort());
    expect(PLANT_ICON_KEYS).toHaveLength(56);
  });

  it('has a fallback icon for every category', () => {
    expect(Object.keys(CATEGORY_ICONS).sort()).toEqual(['GEMUESE', 'KRAUT', 'OBST']);
    for (const key of Object.values(CATEGORY_ICONS)) expect(hasIcon(key), key).toBe(true);
  });

  describe.each(Object.keys(ICONS))('%s', (key) => {
    const shapes = ICONS[key] ?? [];

    it('consists of valid paths with flat #rrggbb colours', () => {
      expect(shapes.length).toBeGreaterThan(0);
      for (const shape of shapes) {
        expect(shape.d).toMatch(/^M[\d.\-\sMLHVQCAZ]+$/);
        expect(shape.fill ?? shape.stroke).toBeDefined();
        if (shape.stroke) expect(shape.width).toBeGreaterThan(0);
      }
      for (const color of colorsOf(key)) expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('uses at most three colours', () => {
      expect(colorsOf(key).size).toBeLessThanOrEqual(3);
    });

    it('stays visible on light and dark backgrounds', () => {
      const visible = [...colorsOf(key)].some(
        (c) => contrast(c, LIGHT_BG) >= 3 && contrast(c, DARK_BG) >= 3,
      );
      expect(visible, `no colour with 3:1 contrast on both backgrounds`).toBe(true);
    });
  });

  it.each([
    ['radieschen', 'rettich'],
    ['weisskohl', 'rotkohl'],
    ['weisskohl', 'wirsing'],
    ['rotkohl', 'wirsing'],
    ['knollensellerie', 'staudensellerie'],
  ])('tells %s and %s apart by colour and shape', (a, b) => {
    expect(colorsOf(a)).not.toEqual(colorsOf(b));
    const silhouette = (key: string) => ICONS[key]?.map((s) => s.d).join('');
    expect(silhouette(a)).not.toBe(silhouette(b));
  });
});

describe('resolveIconKey', () => {
  it('uses the plant icon when it exists', () => {
    expect(resolveIconKey({ icon: 'tomate', category: 'GEMUESE' })).toBe('tomate');
  });

  it('falls back to the category icon', () => {
    expect(resolveIconKey({ icon: 'banane', category: 'OBST' })).toBe('category-obst');
    expect(resolveIconKey({ icon: 'unbekannt', category: 'KRAUT' })).toBe('category-kraut');
  });
});
