import { useTranslation } from 'react-i18next';
import { SignOutButton } from '@/components/layout/AppShell';
import { LanguageButtons } from '@/components/layout/LanguageToggle';
import { PageHeader } from '@/components/layout/PageHeader';
import { AssistantMemoryCard } from '@/components/profile/AssistantMemoryCard';
import { GardenSettingsCard } from '@/components/profile/GardenSettingsCard';
import { ViewCard } from '@/components/profile/ViewCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { canUseAssistant } from '@/lib/assistant';
import { useAuth } from '@/lib/auth/context';
import { isAdmin } from '@/lib/auth/types';
import { useTheme, type Theme } from '@/lib/theme';

const themes: readonly Theme[] = ['light', 'dark', 'system'];

export function ProfilePage() {
  const { t } = useTranslation(['profile', 'layout']);
  const { theme, setTheme } = useTheme();
  const { user, guest } = useAuth();

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('account.title')}</CardTitle>
            <CardDescription>
              {t('account.signedInAs')}{' '}
              <span className="text-foreground font-medium">{user?.email}</span>
              {isAdmin(user) && ` · ${t('account.admin')}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignOutButton variant="card" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('appearance.title')}</CardTitle>
            <CardDescription>{t('appearance.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div role="group" aria-label={t('layout:theme.name')} className="flex flex-wrap gap-2">
              {themes.map((value) => (
                <Button
                  key={value}
                  variant={theme === value ? 'default' : 'outline'}
                  aria-pressed={theme === value}
                  onClick={() => {
                    setTheme(value);
                  }}
                >
                  {t(`layout:theme.${value}`)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('language.title')}</CardTitle>
            <CardDescription>{t('language.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageButtons />
          </CardContent>
        </Card>
        <ViewCard />
        <GardenSettingsCard />
        {canUseAssistant(user, guest) && <AssistantMemoryCard />}
      </div>
    </>
  );
}
