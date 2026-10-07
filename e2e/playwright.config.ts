import { defineConfig, devices } from '@playwright/test';

const port = 5173;

// Runs against the Vite dev server. MSW and the prod smoke suite follow in T-34.
export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${String(port)}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  expect: {
    // Strict enough to notice small UI changes such as a new button in the sidebar.
    toHaveScreenshot: { maxDiffPixelRatio: 0.001 },
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    // iPhone viewport, touch and user agent, rendered with Chromium so all projects
    // share one browser; switch to WebKit once it is installed in CI (T-34).
    { name: 'iphone', use: { ...devices['iPhone 15'], browserName: 'chromium' } },
    { name: 'pixel', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm --filter web dev',
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
