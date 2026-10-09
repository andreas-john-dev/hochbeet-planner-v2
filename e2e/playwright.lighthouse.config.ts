import { defineConfig } from '@playwright/test';

const port = 4173;

// Lighthouse (mobile preset) against the production build in `vite preview`, with the mock
// auth and API from config.dev.json. Thresholds in lighthouse/lighthouse.spec.ts.
export default defineConfig({
  testDir: './lighthouse',
  // Lighthouse needs the CPU for itself; parallel runs would distort Performance.
  workers: 1,
  timeout: 180_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: `http://localhost:${String(port)}` },
  webServer: {
    command: `pnpm --filter web build && pnpm --filter web preview --port ${String(port)} --strictPort`,
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
