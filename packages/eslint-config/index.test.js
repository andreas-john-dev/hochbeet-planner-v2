import { describe, expect, it } from 'vitest';
import prettier from 'eslint-config-prettier';
import config from './index.js';

describe('eslint config', () => {
  it('forbids any in TypeScript files', () => {
    const tsConfig = config.find(
      (c) => c.files?.includes('**/*.ts') && c.rules?.['@typescript-eslint/no-explicit-any'],
    );
    expect(tsConfig?.rules?.['@typescript-eslint/no-explicit-any']).toBe('error');
  });

  it('ends with prettier so formatting rules are disabled', () => {
    expect(config.at(-1)?.rules).toEqual(prettier.rules);
  });
});

describe('react eslint config', () => {
  it('extends the base config with the react hooks rules', async () => {
    const { default: react } = await import('./react.js');
    expect(react.length).toBeGreaterThan(config.length);
    expect(react.some((c) => c.rules?.['react-hooks/rules-of-hooks'])).toBe(true);
  });
});

describe('i18n eslint config', () => {
  it('forbids literal text in JSX outside tests and the dev pages', async () => {
    const { default: i18n } = await import('./i18n.js');
    const [config] = i18n;
    expect(config?.rules?.['i18next/no-literal-string']).toEqual([
      'error',
      { mode: 'jsx-text-only' },
    ]);
    expect(config?.ignores).toEqual(['**/*.test.tsx', '**/src/routes/dev/**']);
  });

  it('reports literal JSX text and accepts translated text', async () => {
    const { ESLint } = await import('eslint');
    const { default: tseslint } = await import('typescript-eslint');
    const { default: i18n } = await import('./i18n.js');
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        ...i18n,
        { files: ['**/*.tsx'], languageOptions: { parser: tseslint.parser } },
      ],
    });
    const lint = async (code, filePath) =>
      (await eslint.lintText(code, { filePath }))[0]?.messages.map((m) => m.ruleId);
    // Components are function declarations; the plugin skips JSX in `const A = () => …`.
    const literal = 'export function A() { return <p>Hallo Beet</p>; }';
    expect(await lint(literal, 'src/components/A.tsx')).toEqual(['i18next/no-literal-string']);
    const translated = 'export function A() { return <p>{t("x")}</p>; }';
    expect(await lint(translated, 'src/components/A.tsx')).toEqual([]);
    expect(await lint(literal, 'src/routes/dev/A.tsx')).toEqual([]);
    expect(await lint(literal, 'src/components/A.test.tsx')).toEqual([]);
  });
});
