import { MAX_ASSISTANT_MESSAGE_CHARS, type Suggestion } from '@hochbeet/contracts';
import { Bot, MessageSquarePlus, Send, Sprout, Square } from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { FormMessage } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/lib/api';
import { useApiStream } from '@/lib/api-context';
import { askAssistant, newSessionId } from '@/lib/assistant';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

/** Question sent with „Pflanzvorschläge“ when the field is empty. */
export const DEFAULT_SUGGESTION_QUESTION = 'Was kann ich in dieses Beet noch pflanzen?';

/**
 * Chat with the Beet-Assistent about the bed on screen. Answers stream in and can be
 * cancelled; the quota left today shows after each answer. One runtime session per
 * conversation: the agent remembers it, „Neue Unterhaltung“ starts a fresh one.
 */
export function AssistantChat({
  bedId,
  active = true,
  onSuggestions,
  suggestions,
  className,
}: {
  bedId: string;
  /** Focuses the question field whenever the chat is shown (e.g. the panel opens). */
  active?: boolean;
  /** Receives checked planting suggestions; without it the chat offers none. */
  onSuggestions?: (suggestions: Suggestion[], warnings: string[]) => void;
  /** The suggestions currently shown in the bed, rendered below the conversation. */
  suggestions?: ReactNode;
  className?: string;
}) {
  const stream = useApiStream();
  const [sessionId, setSessionId] = useState(newSessionId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  const [remaining, setRemaining] = useState<number>();
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const hintId = useId();

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (active) input.current?.focus();
  }, [active]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages]);

  const appendToAnswer = (text: string) => {
    setMessages((all) => {
      const last = all.at(-1);
      return last?.role === 'assistant'
        ? [...all.slice(0, -1), { ...last, text: last.text + text }]
        : [...all, { role: 'assistant', text }];
    });
  };

  const ask = async (event?: SyntheticEvent, suggest = false) => {
    event?.preventDefault();
    const message = draft.trim() || (suggest ? DEFAULT_SUGGESTION_QUESTION : '');
    if (!message || busy) return;
    const controller = new AbortController();
    abort.current = controller;
    setDraft('');
    setError(undefined);
    setBusy(true);
    setMessages((all) => [...all, { role: 'user', text: message }]);
    try {
      const result = await askAssistant(stream, {
        message,
        bedId,
        sessionId,
        signal: controller.signal,
        onText: appendToAnswer,
        ...(suggest && onSuggestions ? { suggest, onSuggestions } : {}),
      });
      setRemaining(result.remaining);
    } catch (cause) {
      if (isAbort(cause)) appendToAnswer(' (abgebrochen)');
      else setError(apiErrorMessage(cause));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  /** A new session: the agent no longer knows the previous messages (preferences stay). */
  const restart = () => {
    setMessages([]);
    setError(undefined);
    setSessionId(newSessionId());
    input.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter starts a new line.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      void ask(event);
    }
  };

  return (
    <section
      aria-label="Beet-Assistent"
      className={cn('flex min-h-0 flex-col gap-3 overflow-y-auto', className)}
    >
      <div
        ref={log}
        role="log"
        aria-label="Unterhaltung mit dem Assistenten"
        aria-live="polite"
        aria-busy={busy}
        // Scrollable, so keyboard users must be able to reach it.
        tabIndex={0}
        className="focus-visible:ring-ring/50 flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto rounded-md outline-none focus-visible:ring-[3px]"
      >
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Frag zum Beispiel, was neben deine Tomaten passt oder warum eine Warnung erscheint.
          </p>
        ) : (
          messages.map((m, index) => (
            <div
              // Messages are only ever appended, so the index is a stable key.
              key={index}
              data-role={m.role}
              className={cn(
                'max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground self-end'
                  : 'bg-muted self-start',
              )}
            >
              <span className="sr-only">{m.role === 'user' ? 'Du: ' : 'Assistent: '}</span>
              {m.text}
            </div>
          ))
        )}
        {busy && messages.at(-1)?.role === 'user' && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Bot className="size-4 animate-pulse" aria-hidden />
            Der Assistent denkt nach …
          </p>
        )}
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {suggestions}
      <form className="flex flex-col gap-2" onSubmit={(e) => void ask(e)}>
        <Label htmlFor={inputId}>Frage an den Assistenten</Label>
        <textarea
          ref={input}
          id={inputId}
          aria-describedby={hintId}
          value={draft}
          maxLength={MAX_ASSISTANT_MESSAGE_CHARS}
          rows={2}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onKeyDown={onKeyDown}
          className="bg-card placeholder:text-muted-foreground focus-visible:ring-ring/50 min-h-16 w-full resize-y rounded-md border px-3 py-2 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
          placeholder="Was passt gut zu Tomaten?"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2">
            <p className="text-muted-foreground text-xs" aria-live="polite">
              {remaining !== undefined && `Noch ${String(remaining)} Fragen heute.`}
            </p>
            {messages.length > 0 && !busy && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-11 px-2 md:h-8"
                onClick={restart}
              >
                <MessageSquarePlus aria-hidden />
                Neue Unterhaltung
              </Button>
            )}
          </div>
          {busy ? (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => abort.current?.abort()}
            >
              <Square aria-hidden />
              Abbrechen
            </Button>
          ) : (
            <div className="flex gap-2">
              {onSuggestions && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  title="Geprüfte Pflanzvorschläge für dieses Beet, zu deiner Frage oder allgemein"
                  onClick={(e) => void ask(e, true)}
                >
                  <Sprout aria-hidden />
                  Pflanzvorschläge
                </Button>
              )}
              <Button type="submit" className="h-11" disabled={!draft.trim()}>
                <Send aria-hidden />
                Fragen
              </Button>
            </div>
          )}
        </div>
      </form>
      <p id={hintId} className="text-muted-foreground text-xs">
        Antworten stammen von einer KI und können falsch sein. Enter sendet, Umschalt+Enter macht
        eine neue Zeile.
      </p>
    </section>
  );
}
