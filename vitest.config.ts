import { defineConfig } from 'vitest/config';

// Runs all workspace projects in one process, e.g. `pnpm exec vitest` from the repo root.
// `pnpm test` runs the same tests per package via Turborepo.
export default defineConfig({
  test: {
    projects: [
      'apps/*/vitest.config.ts',
      'services/*/vitest.config.ts',
      'packages/*/vitest.config.{ts,js}',
      'infra/vitest.config.ts',
    ],
  },
});
