import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Bottom sheet for phones: a dialog that slides up from the bottom edge. */
export const Sheet = DialogPrimitive.Root;

export function SheetContent({
  className,
  children,
  showClose = true,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30" />
      <DialogPrimitive.Content
        className={cn(
          'bg-card text-card-foreground fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-3 rounded-t-2xl border-t px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg outline-none',
          className,
        )}
        {...props}
      >
        <div
          aria-hidden
          className="bg-muted-foreground/30 mx-auto h-1.5 w-10 shrink-0 rounded-full"
        />
        {children}
        {showClose && (
          <DialogPrimitive.Close className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-2 right-2 grid size-11 place-items-center rounded-md outline-none focus-visible:ring-[3px]">
            <XIcon className="size-5" aria-hidden />
            <span className="sr-only">Schließen</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title className={cn('pr-10 text-lg font-semibold', className)} {...props} />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}
