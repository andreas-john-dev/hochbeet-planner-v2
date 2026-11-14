import type { SowingWithPlantings } from '@hochbeet/contracts';
import { useTranslation } from 'react-i18next';
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
import { useBeds, useDeleteSowing } from '@/lib/garden';
import { useLanguage } from '@/lib/i18n';
import { linkedPlantingsText } from '@/lib/sowings';

/** Asks before deleting a batch and names the plantings that come from it. */
export function DeleteSowingDialog({
  item,
  plantName,
  open,
  onOpenChange,
}: {
  item: SowingWithPlantings;
  plantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation(['sowings', 'common']);
  const { language } = useLanguage();
  const remove = useDeleteSowing();
  const beds = useBeds();
  const bedName = (bedId: string) =>
    beds.data?.find((b) => b.id === bedId)?.name ?? t('deleteDialog.someBed');
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
          <DialogTitle>{t('deleteDialog.title', { name: plantName })}</DialogTitle>
          <DialogDescription>
            {linkedPlantingsText(item.plantings, bedName, language) ??
              t('deleteDialog.nothingLinked')}{' '}
            {t('deleteDialog.irreversible')}
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
            {t('common:cancel')}
          </Button>
          <Button
            className="bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
            disabled={remove.isPending}
            onClick={() => {
              void remove
                .mutateAsync(item.sowing.id)
                .then(() => {
                  onOpenChange(false);
                })
                .catch(() => undefined);
            }}
          >
            {t('deleteDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
