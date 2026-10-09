import { defineConfig, devices } from '@playwright/test';

const port = 5173;

// Runs against the Vite dev server, whose API is mocked with MSW (apps/web/src/mocks).
// The `setup` project signs in once per account and stores the login state (storageState).
export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${String(port)}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  expect: {
    // Strict enough to notice small UI changes such as a new button in the sidebar.
    // screenshot.css keeps fixed bars at the page edges in full-page screenshots.
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, stylePath: './screenshot.css' },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    // iPhone viewport, touch and user agent, rendered with Chromium so all projects share one
    // browser and one set of screenshot baselines.
    {
      name: 'iphone',
      use: { ...devices['iPhone 15'], browserName: 'chromium' },
      dependencies: ['setup'],
    },
    { name: 'pixel', use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
  ],
  webServer: {
    command: 'pnpm --filter web dev',
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
