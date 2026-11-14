import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n';
import { LANGUAGES } from '@/lib/language';

/**
 * Small switch on the auth pages: names the other language in that language. With more than
 * two languages this becomes a menu.
 */
export function LanguageToggle() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const other = LANGUAGES.find((l) => l !== language) ?? 'de';
  return (
    <Button
      variant="ghost"
      size="sm"
      lang={other}
      onClick={() => {
        setLanguage(other);
      }}
    >
      {t(`language.${other}`)}
    </Button>
  );
}

/** All languages as buttons, the current one pressed; for the profile. */
export function LanguageButtons() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  return (
    <div role="group" aria-label={t('language.label')} className="flex flex-wrap gap-2">
      {LANGUAGES.map((value) => (
        <Button
          key={value}
          lang={value}
          variant={language === value ? 'default' : 'outline'}
          aria-pressed={language === value}
          onClick={() => {
            setLanguage(value);
          }}
        >
          {t(`language.${value}`)}
        </Button>
      ))}
    </div>
  );
}
