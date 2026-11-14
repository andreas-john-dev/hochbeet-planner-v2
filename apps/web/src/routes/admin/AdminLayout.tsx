import { Link, Outlet } from '@tanstack/react-router';
import { ShieldOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/context';
import { isAdmin } from '@/lib/auth/types';

/**
 * The admin area: its pages for admins, a 403 page for everyone else. The navigation hides the
 * area anyway; this covers direct calls. The data itself is protected by the catalog service.
 */
export function AdminLayout() {
  const { user } = useAuth();
  return isAdmin(user) ? <Outlet /> : <ForbiddenPage />;
}

function ForbiddenPage() {
  const { t } = useTranslation('layout');
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <span className="bg-secondary text-secondary-foreground grid size-12 place-items-center rounded-full">
        <ShieldOff aria-hidden className="size-6" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">{t('forbidden.title')}</h1>
      <p className="text-muted-foreground max-w-sm">{t('forbidden.text')}</p>
      <Button asChild variant="outline" className="h-11">
        <Link to="/beete">{t('toBeds')}</Link>
      </Button>
    </div>
  );
}
