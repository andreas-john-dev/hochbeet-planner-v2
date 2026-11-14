import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { i18n, useDateLocale, useLanguage } from './i18n';
import { LANGUAGE_STORAGE_KEY } from './language';

function Probe() {
  const { language, setLanguage } = useLanguage();
  const locale = useDateLocale();
  return (
    <button
      onClick={() => {
        setLanguage(language === 'de' ? 'en' : 'de');
      }}
    >
      {language} {locale.code}
    </button>
  );
}

describe('useLanguage', () => {
  it('switches the app, remembers the choice and updates the page', () => {
    render(<Probe />);
    expect(screen.getByRole('button')).toHaveTextContent('de de');
    expect(document.documentElement.lang).toBe('de');

    act(() => {
      screen.getByRole('button').click();
    });

    expect(screen.getByRole('button')).toHaveTextContent('en en-GB');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('Hochbeet-Planer');
    expect(i18n.t('layout:nav.beds')).toBe('Beds');
    // Zod's own messages follow as well.
    expect(z.string().safeParse(1).error?.issues[0]?.message).toMatch(/^Invalid input/);
    localStorage.clear();
  });
});
