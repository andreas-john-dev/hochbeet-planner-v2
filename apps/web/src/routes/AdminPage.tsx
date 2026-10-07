import { ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';

export function AdminPage() {
  return (
    <>
      <PageHeader
        title="Administration"
        description="Globale Sorten pflegen und Publikationsanfragen prüfen."
      />
      <EmptyState icon={ShieldCheck} title="Keine offenen Anfragen">
        Neue Publikationsanfragen erscheinen hier in einer Warteschlange.
      </EmptyState>
    </>
  );
}
