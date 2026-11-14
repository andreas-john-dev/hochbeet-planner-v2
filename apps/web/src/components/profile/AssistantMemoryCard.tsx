import { ASSISTANT_CONVERSATION_DAYS } from '@hochbeet/contracts';
import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SkeletonList } from '@/components/ui/skeleton';
import { apiErrorMessage } from '@/lib/api';
import { useAssistantMemories, useForgetAssistantMemories } from '@/lib/assistant-memory';

/**
 * What the Beet-Assistent remembers about the user (preferences from their conversations),
 * with the option to delete all of it, including the stored conversations.
 */
export function AssistantMemoryCard() {
  const { t } = useTranslation(['profile', 'common']);
  const memories = useAssistantMemories(true);
  const forget = useForgetAssistantMemories();
  const [confirming, setConfirming] = useState(false);
  const [forgotten, setForgotten] = useState(false);
  const listId = useId();
  const items = memories.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('assistant.title')}</CardTitle>
        <CardDescription>
          {t('assistant.description', { count: ASSISTANT_CONVERSATION_DAYS })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <h3 id={listId} className="text-sm font-semibold">
          {t('assistant.memories')}
        </h3>
        {memories.isPending ? (
          <SkeletonList
            label={t('assistant.loading')}
            count={2}
            className="flex flex-col gap-2"
            itemClassName="h-6 rounded-md"
          />
        ) : memories.isError ? (
          <FormMessage tone="error">{apiErrorMessage(memories.error)}</FormMessage>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {forgotten ? t('assistant.forgotten') : t('assistant.empty')}
          </p>
        ) : (
          <ul aria-labelledby={listId} className="flex flex-col gap-1 text-sm">
            {items.map((memory) => (
              <li key={memory.id} className="bg-muted/40 rounded-md border px-3 py-2">
                {memory.text}
              </li>
            ))}
          </ul>
        )}
        <div>
          <Button
            variant="outline"
            disabled={memories.isPending}
            onClick={() => {
              forget.reset();
              setConfirming(true);
            }}
          >
            <Trash2 aria-hidden />
            {t('assistant.forget')}
          </Button>
        </div>
      </CardContent>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>{t('assistant.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('assistant.confirmText')}</DialogDescription>
          </DialogHeader>
          {forget.isError && (
            <FormMessage tone="error">{apiErrorMessage(forget.error)}</FormMessage>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirming(false);
              }}
            >
              {t('common:cancel')}
            </Button>
            <Button
              className="bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
              disabled={forget.isPending}
              onClick={() => {
                void forget
                  .mutateAsync()
                  .then(() => {
                    setForgotten(true);
                    setConfirming(false);
                  })
                  .catch(() => undefined);
              }}
            >
              {t('assistant.forget')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
