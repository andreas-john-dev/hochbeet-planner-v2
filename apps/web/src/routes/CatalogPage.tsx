import { Leaf } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';

export function CatalogPage() {
  return (
    <>
      <PageHeader
        title="Pflanzenkatalog"
        description="Gemüse, Obst und Kräuter mit Abständen, Standzeit und Nachbarn."
      />
      <EmptyState icon={Leaf} title="Katalog folgt">
        Hier findest du bald alle Sorten, deine eigenen Sorten und persönliche Anpassungen.
      </EmptyState>
    </>
  );
}
