import AxeBuilder from '@axe-core/playwright';
import { expect, open, signInAs, test } from './fixtures';
import { seedFor } from './garden';
import { appPages } from './pages';

// Every page in light and dark mode against WCAG 2.1 A/AA (contrast, names, landmarks, ...).
for (const colorScheme of ['light', 'dark'] as const) {
  for (const appPage of appPages) {
    test(`${appPage.id} has no WCAG A/AA violations (${colorScheme})`, async ({ page }) => {
      await signInAs(page, appPage.access);
      if (appPage.seed) await seedFor(page, appPage.access, appPage.seed);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await open(page, appPage.path, appPage.heading);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const summary = violations.map((v) => ({
        rule: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => `${n.target.join(' ')}: ${n.failureSummary ?? ''}`).slice(0, 5),
      }));
      expect(summary).toEqual([]);
    });
  }
}

test('keyboard focus is always visible', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keyboard navigation is a desktop concern.');
  await signInAs(page, 'user');
  await open(page, '/katalog', 'Pflanzenkatalog');
  // Sidebar, theme toggle, search, filter chips and the first plants.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const text = el.textContent.trim().slice(0, 30);
      return {
        name: text !== '' ? text : (el.getAttribute('aria-label') ?? el.tagName),
        outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
        ring: style.boxShadow !== 'none',
      };
    });
    expect(focus, `focus after ${String(i + 1)} × Tab`).not.toBeNull();
    expect(
      focus !== null && (focus.outline || focus.ring),
      `visible focus on ${focus?.name ?? ''}`,
    ).toBe(true);
  }
});
