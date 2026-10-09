import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { type BrowserContext, chromium, expect, test } from '@playwright/test';
import { EXAMPLE_BED_ID, exampleGarden } from '../tests/garden';
import { USERS } from '../tests/fixtures';

/** Minimum scores (0–100) on the mobile preset, see T-35. */
const MIN_SCORE = { performance: 90, accessibility: 90 } as const;
const PORT = 9333;
/**
 * Run with npx instead of a dependency: Lighthouse brings @opentelemetry/api into the
 * workspace, which splits vitest into two copies and breaks the jest-dom types.
 */
const LIGHTHOUSE = 'lighthouse@12.8.2';
const outDir = resolve(process.env.LIGHTHOUSE_DIR ?? 'lighthouse-out');

const pages = [
  { id: 'anmelden', path: '/anmelden', signedIn: false },
  { id: 'beete', path: '/beete', signedIn: true },
  { id: 'beet-editor', path: `/beete/${EXAMPLE_BED_ID}`, signedIn: true },
  { id: 'katalog', path: '/katalog', signedIn: true },
];

let context: BrowserContext;

// One persistent browser with a debugging port: Lighthouse opens its tabs there and, with
// storage reset disabled, sees the mock session and data written below.
test.beforeAll(async ({ baseURL }) => {
  context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'lighthouse-')), {
    args: [`--remote-debugging-port=${String(PORT)}`],
  });
  const page = await context.newPage();
  await page.goto(baseURL ?? '/');
  await page.evaluate(
    ([email, garden]) => {
      localStorage.setItem('hochbeet-mock-api', JSON.stringify({ [email]: garden }));
    },
    [USERS.user.email, exampleGarden] as const,
  );
  await page.close();
  mkdirSync(outDir, { recursive: true });
});

test.afterAll(async () => {
  await context.close();
});

for (const { id, path, signedIn } of pages) {
  test(`${id} scores at least 90 for performance and accessibility on mobile`, async ({
    baseURL,
  }) => {
    const page = await context.newPage();
    await page.goto(baseURL ?? '/');
    await page.evaluate(
      ([session]) => {
        if (session) localStorage.setItem('hochbeet-mock-auth', JSON.stringify({ session }));
        else localStorage.removeItem('hochbeet-mock-auth');
      },
      [signedIn ? USERS.user.email : null] as const,
    );
    await page.close();

    const outputPath = join(outDir, id);
    await promisify(execFile)(
      'npx',
      [
        '--yes',
        LIGHTHOUSE,
        `${baseURL ?? ''}${path}`,
        `--port=${String(PORT)}`,
        '--output=json',
        '--output=html',
        `--output-path=${outputPath}`,
        '--only-categories=performance,accessibility,best-practices',
        '--disable-storage-reset',
        '--quiet',
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    const report = JSON.parse(readFileSync(`${outputPath}.report.json`, 'utf8')) as {
      finalDisplayedUrl: string;
      categories: Record<string, { score: number | null } | undefined>;
    };
    // A signed-out visit to a protected page would end on the sign-in page.
    expect(new URL(report.finalDisplayedUrl).pathname).toBe(path);
    const score = (category: string) => Math.round((report.categories[category]?.score ?? 0) * 100);
    const scores = {
      performance: score('performance'),
      accessibility: score('accessibility'),
      'best-practices': score('best-practices'),
    };
    console.log(`${id}: ${JSON.stringify(scores)}`);
    expect.soft(scores.performance).toBeGreaterThanOrEqual(MIN_SCORE.performance);
    expect.soft(scores.accessibility).toBeGreaterThanOrEqual(MIN_SCORE.accessibility);
  });
}
