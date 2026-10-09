import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/context';

/**
 * Starts guest mode: plan right away, data stays in this browser. Guests who came here to sign
 * in can go back to their beds instead.
 */
export function TryWithoutAccount() {
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
        {guest ? 'Weiter ohne Konto' : 'Ohne Konto ausprobieren'}
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        {guest
          ? 'Deine Beete liegen weiter nur in diesem Browser.'
          : 'Deine Beete bleiben dann nur in diesem Browser.'}
      </p>
    </div>
  );
}
