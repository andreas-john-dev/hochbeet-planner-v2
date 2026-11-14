import { Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Logo() {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">
        <Sprout className="size-[18px]" aria-hidden />
      </span>
      {t('appName')}
    </span>
  );
}
