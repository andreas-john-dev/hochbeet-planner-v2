import { defineConfig, devices } from '@playwright/test';

// Projects for iPhone and Pixel, the dev server with MSW and the prod smoke suite follow in T-04 and T-34.
export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  projects: [{ name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } }],
});
