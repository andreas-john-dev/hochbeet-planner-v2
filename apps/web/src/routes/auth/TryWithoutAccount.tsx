import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/context';

/**
 * Starts guest mode: plan right away, data stays in this browser. Guests who came here to sign
 * in can go back to their beds instead.
 */
export function TryWithoutAccount() {
  const { t } = useTranslation('auth');
  const { guest, startGuest } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="mt-6 flex flex-col gap-2 border-t pt-6">
      <Button
        variant="outline"
        onClick={() => {
          startGuest();
          void navigate({ to: '/beete' });
        }}
      >
        {guest ? t('guest.continue') : t('guest.start')}
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        {guest ? t('guest.continueHint') : t('guest.startHint')}
      </p>
    </div>
  );
}
