import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// Full-page screenshots of every page for pull request comments (see .github/workflows/screenshots.yml).
export default defineConfig({
  ...base,
  testDir: './screenshots',
  retries: 0,
  reporter: 'list',
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 15'], browserName: 'chromium' } },
  ],
});
