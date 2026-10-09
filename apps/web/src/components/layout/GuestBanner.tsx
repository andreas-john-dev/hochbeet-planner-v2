import { Link, useNavigate } from '@tanstack/react-router';
import { HardDrive } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth/context';

/** Reminds guests that their data lives only in this browser; links to an account. */
export function GuestBanner() {
  const [ending, setEnding] = useState(false);
  return (
    <section
      aria-label="Gastmodus"
      data-testid="guest-banner"
      className="bg-card mb-6 flex flex-col gap-3 rounded-xl border p-4 text-sm md:mb-8 md:flex-row md:items-center"
    >
      <div className="flex flex-1 items-start gap-3">
        <HardDrive aria-hidden className="text-muted-foreground mt-0.5 size-5 shrink-0" />
        <p>
          <span className="font-medium">Du planst ohne Konto.</span> Deine Beete liegen nur in
          diesem Browser. Mit einem Konto sind sie gesichert und auf allen Geräten da.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <Link to="/registrieren">Konto anlegen</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/anmelden">Anmelden</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEnding(true);
          }}
        >
          Gastmodus beenden
        </Button>
      </div>
      <EndGuestDialog open={ending} onOpenChange={setEnding} />
    </section>
  );
}

/** Ends guest mode; the guest decides whether the local data stays for a later visit. */
function EndGuestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { endGuest } = useAuth();
  const navigate = useNavigate();
  const end = (deleteData: boolean) => {
    endGuest({ deleteData });
    void navigate({ to: '/anmelden' });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>Gastmodus beenden?</DialogTitle>
          <DialogDescription>
            Deine Beete, Pflanzungen und eigenen Sorten liegen nur in diesem Browser. Behalte sie
            für später oder lösche sie jetzt. Löschen lässt sich nicht rückgängig machen.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Abbrechen
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              end(false);
            }}
          >
            Daten behalten
          </Button>
          <Button
            className="bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
            onClick={() => {
              end(true);
            }}
          >
            Daten löschen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
