import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewOptions } from '@/components/ViewChoice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** "Ansicht" in the profile: simple or expert, for all beds and devices (T-73). */
export function ViewCard() {
  const { t } = useTranslation(['profile', 'common']);
  const titleId = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle id={titleId}>{t('common:view.label')}</CardTitle>
        <CardDescription>{t('view.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ViewOptions labelledBy={titleId} />
      </CardContent>
    </Card>
  );
}
