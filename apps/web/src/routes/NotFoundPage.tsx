import { Link } from '@tanstack/react-router';
import { MapPinOff } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <EmptyState icon={MapPinOff} title="Seite nicht gefunden">
        Diese Adresse gibt es nicht. Vielleicht hat sich ein Tippfehler eingeschlichen.
      </EmptyState>
      <Button asChild variant="outline">
        <Link to="/beete">Zu den Beeten</Link>
      </Button>
    </div>
  );
}
