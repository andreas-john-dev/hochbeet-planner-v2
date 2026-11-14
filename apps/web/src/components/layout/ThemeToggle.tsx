import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useTheme, type Theme } from '@/lib/theme';

const order: Theme[] = ['light', 'dark', 'system'];
const icons = { light: Sun, dark: Moon, system: Monitor } as const;

/** Cycles through light, dark and system colour scheme. */
export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { t } = useTranslation('layout');
  const { theme, setTheme } = useTheme();
  const next = order[(order.indexOf(theme) + 1) % order.length] ?? 'system';
  const Icon = icons[theme];

  return (
    <Button
      variant="ghost"
      size={showLabel ? 'default' : 'icon'}
      className={showLabel ? 'w-full justify-start' : undefined}
      onClick={() => {
        setTheme(next);
      }}
      aria-label={t('theme.switch', { theme: t(`theme.${theme}`), next: t(`theme.${next}`) })}
    >
      <Icon aria-hidden />
      {showLabel && <span>{t('theme.current', { theme: t(`theme.${theme}`) })}</span>}
    </Button>
  );
}
