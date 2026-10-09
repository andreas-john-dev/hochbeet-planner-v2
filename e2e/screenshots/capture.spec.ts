import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { open, signInAs, test } from '../tests/fixtures';
import { seedFor } from '../tests/garden';
import { appPages } from '../tests/pages';

const outDir = resolve(process.env.SCREENSHOT_DIR ?? 'screenshots-out');
// Same fixes for fixed bars as in the screenshot tests (see screenshot.css).
const style = readFileSync(resolve(import.meta.dirname, '../screenshot.css'), 'utf8');

test.beforeAll(() => {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(appPages, null, 2));
});

for (const appPage of appPages) {
  test(appPage.id, async ({ page }, testInfo) => {
    await signInAs(page, appPage.access);
    if (appPage.seed) await seedFor(page, appPage.access, appPage.seed);
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page, appPage.path, appPage.heading);
    await page.screenshot({
      path: join(outDir, testInfo.project.name, `${appPage.id}.png`),
      fullPage: true,
      animations: 'disabled',
      style,
    });
  });
}
