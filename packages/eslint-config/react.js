import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import base from './index.js';

/** Flat config for React apps: shared base plus hooks and Vite fast-refresh rules. */
export default tseslint.config(...base, {
  files: ['**/*.tsx', '**/*.ts'],
  extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
  languageOptions: {
    globals: globals.browser,
  },
});
