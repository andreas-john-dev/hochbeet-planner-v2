import { ASSISTANT_CONVERSATION_DAYS } from '@hochbeet/contracts';
import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
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
  const memories = useAssistantMemories(true);
  const forget = useForgetAssistantMemories();
  const [confirming, setConfirming] = useState(false);
  const [forgotten, setForgotten] = useState(false);
  const listId = useId();
  const items = memories.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Beet-Assistent</CardTitle>
        <CardDescription>
          Der Assistent merkt sich Vorlieben aus euren Gesprächen, etwa was du nicht magst, wo du
          gärtnerst oder wie sonnig dein Beet steht. Die Gespräche selbst bleiben{' '}
          {ASSISTANT_CONVERSATION_DAYS} Tage gespeichert.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <h3 id={listId} className="text-sm font-semibold">
          Gemerkte Vorlieben
        </h3>
        {memories.isPending ? (
          <SkeletonList
            label="Vorlieben werden geladen"
            count={2}
            className="flex flex-col gap-2"
            itemClassName="h-6 rounded-md"
          />
        ) : memories.isError ? (
          <FormMessage tone="error">{apiErrorMessage(memories.error)}</FormMessage>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {forgotten ? 'Der Assistent hat alles vergessen.' : 'Noch keine Vorlieben gemerkt.'}
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
            Alles löschen
          </Button>
        </div>
      </CardContent>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>Alles löschen, was der Assistent weiß?</DialogTitle>
            <DialogDescription>
              Gelöscht werden alle gemerkten Vorlieben und die gespeicherten Gespräche. Das lässt
              sich nicht rückgängig machen.
            </DialogDescription>
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
              Abbrechen
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
              Alles löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
