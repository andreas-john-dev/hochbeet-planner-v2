import type { Bed } from '@hochbeet/contracts';
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
import { useDeleteBed } from '@/lib/garden';

/** Asks before deleting a bed; deleting removes all its plantings as well. */
export function DeleteBedDialog({
  bed,
  open,
  onOpenChange,
}: {
  bed: Bed;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const remove = useDeleteBed();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) remove.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>Beet „{bed.name}“ löschen?</DialogTitle>
          <DialogDescription>
            Alle Pflanzungen dieses Beets werden ebenfalls gelöscht. Das lässt sich nicht rückgängig
            machen.
          </DialogDescription>
        </DialogHeader>
        {remove.isError && <FormMessage tone="error">{apiErrorMessage(remove.error)}</FormMessage>}
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
            className="bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
            disabled={remove.isPending}
            onClick={() => {
              void remove
                .mutateAsync(bed.id)
                .then(() => {
                  onOpenChange(false);
                })
                .catch(() => undefined);
            }}
          >
            Beet löschen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
