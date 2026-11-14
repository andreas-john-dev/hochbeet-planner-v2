import i18next from 'eslint-plugin-i18next';

/**
 * Flat config for translated React apps: no literal text in JSX, UI texts only via `t()`.
 * Tests and the dev pages under `src/routes/dev` may use literal text.
 */
export default [
  {
    files: ['**/*.tsx'],
    ignores: ['**/*.test.tsx', '**/src/routes/dev/**'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },
];
