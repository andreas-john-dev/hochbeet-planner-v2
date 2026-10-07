import { defineConfig, devices } from '@playwright/test';

// Read-only smoke tests against a deployed stage, e.g. after `cdk deploy` in the deploy workflow:
// SMOKE_BASE_URL=https://d123.cloudfront.net pnpm --filter e2e smoke
const baseURL = process.env.SMOKE_BASE_URL;
if (!baseURL) throw new Error('SMOKE_BASE_URL is not set');

export default defineConfig({
  testDir: './smoke',
  testMatch: '**/*.smoke.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL, locale: 'de-DE', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
