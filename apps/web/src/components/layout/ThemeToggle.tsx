import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme, type Theme } from '@/lib/theme';

const order: Theme[] = ['light', 'dark', 'system'];
const labels: Record<Theme, string> = { light: 'Hell', dark: 'Dunkel', system: 'System' };
const icons = { light: Sun, dark: Moon, system: Monitor } as const;

/** Cycles through light, dark and system colour scheme. */
export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
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
      aria-label={`Farbschema: ${labels[theme]}. Wechseln zu ${labels[next]}`}
    >
      <Icon aria-hidden />
      {showLabel && <span>Farbschema: {labels[theme]}</span>}
    </Button>
  );
}
