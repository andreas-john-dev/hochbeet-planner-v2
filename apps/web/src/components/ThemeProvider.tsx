import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { readStoredTheme, THEME_STORAGE_KEY, ThemeContext, type Theme } from '@/lib/theme';

const darkQuery = '(prefers-color-scheme: dark)';

function subscribeToSystemTheme(onChange: () => void) {
  const media = window.matchMedia(darkQuery);
  media.addEventListener('change', onChange);
  return () => {
    media.removeEventListener('change', onChange);
  };
}

function systemPrefersDark() {
  return window.matchMedia(darkQuery).matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const prefersDark = useSyncExternalStore(subscribeToSystemTheme, systemPrefersDark);
  const resolvedTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next: Theme) => {
        setThemeState(next);
        try {
          if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
          else localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // Storage can be unavailable (private mode); the choice then lasts for this visit.
        }
      },
    }),
    [theme, resolvedTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
