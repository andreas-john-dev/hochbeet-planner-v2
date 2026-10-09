import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiErrorMessage } from '@/lib/api';
import { useApi } from '@/lib/api-context';
import { deleteGuestData } from '@/lib/auth/guest';
import { useBeds } from '@/lib/garden';
import {
  describeGuestData,
  guestImportId,
  hasGuestData,
  importGuestData,
} from '@/lib/guest-import';
import { createGuestRepository, type LocalGarden } from '@/lib/local-api/store';

function readGuestGarden(): LocalGarden | undefined {
  try {
    const garden = createGuestRepository().read();
    return hasGuestData(garden) ? garden : undefined;
  } catch {
    return undefined;
  }
}

/**
 * After sign-in or sign-up: offers to move what the user planned as a guest in this browser
 * into the account. „Später“ asks again on the next visit; „Verwerfen“ deletes it.
 */
export function GuestImportDialog() {
  const [garden, setGarden] = useState(readGuestGarden);
  const api = useApi();
  const queryClient = useQueryClient();
  const beds = useBeds();
  const importData = useMutation({
    mutationFn: (data: LocalGarden) => importGuestData(api, data, guestImportId()),
    onSuccess: async () => {
      deleteGuestData();
      setGarden(undefined);
      await queryClient.invalidateQueries();
    },
  });
  if (!garden) return null;

  const accountHasBeds = (beds.data?.length ?? 0) > 0;
  const close = () => {
    setGarden(undefined);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !importData.isPending) close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Beete aus dem Gastmodus übernehmen?</DialogTitle>
          <DialogDescription>
            In diesem Browser liegen {describeGuestData(garden)} aus dem Gastmodus.{' '}
            {accountHasBeds
              ? 'Dein Konto hat schon Beete; die aus diesem Browser kommen dazu.'
              : 'Übernimm sie in dein Konto, dann sind sie gesichert und auf allen Geräten da.'}{' '}
            Verwerfen löscht sie aus diesem Browser.
          </DialogDescription>
        </DialogHeader>
        {importData.isError && (
          <FormMessage tone="error">{apiErrorMessage(importData.error)}</FormMessage>
        )}
        <DialogFooter>
          <Button variant="ghost" disabled={importData.isPending} onClick={close}>
            Später
          </Button>
          <Button
            variant="outline"
            disabled={importData.isPending}
            onClick={() => {
              deleteGuestData();
              close();
            }}
          >
            Verwerfen
          </Button>
          <Button
            disabled={importData.isPending || beds.isPending}
            onClick={() => {
              importData.mutate(garden);
            }}
          >
            {importData.isPending
              ? 'Übernehme …'
              : accountHasBeds
                ? 'Lokale Beete hinzufügen'
                : 'Übernehmen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
