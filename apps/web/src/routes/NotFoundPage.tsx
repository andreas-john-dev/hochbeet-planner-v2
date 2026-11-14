import { Link } from '@tanstack/react-router';
import { MapPinOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const { t } = useTranslation('layout');
  return (
    <div className="flex flex-col items-center gap-6">
      <EmptyState icon={MapPinOff} title={t('notFound.title')}>
        {t('notFound.text')}
      </EmptyState>
      <Button asChild variant="outline">
        <Link to="/beete">{t('toBeds')}</Link>
      </Button>
    </div>
  );
}
