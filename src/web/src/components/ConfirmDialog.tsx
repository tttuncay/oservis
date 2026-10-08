import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { t } from '@/i18n';

/**
 * NFR-USA-070 — *"Destructive actions shall require confirmation and, where the record
 * is financial or operational history, shall be reversible rather than destructive."*
 *
 * This component covers the first half. The second half is the server's: master data is
 * soft-deleted (SDD §5.1) and an assignment is bounded rather than rewritten
 * (FR-CMP-060), so nothing a confirmation here guards is actually lost.
 *
 * The confirming button is `destructive` and is **not** the default focus, so a hurried
 * Enter dismisses rather than deletes.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onCancel())}>
      <DialogContent closeLabel={t('common.close')} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {/* Autofocused, so Enter cancels. The destructive path should cost a click. */}
          <Button variant="outline" onClick={onCancel} autoFocus disabled={pending}>
            {t('confirm.cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {confirmLabel ?? t('confirm.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The dialog plus the "is it open, and for which row" state every list needs.
 *
 * Returned as a tuple of an `ask(target)` function and the element to render, so a
 * screen does not re-declare two `useState`s per destructive action.
 */
export function useConfirm<T>(options: {
  title: (target: T) => string;
  body: (target: T) => string;
  confirmLabel?: string;
  onConfirm: (target: T) => unknown;
  pending?: boolean;
}): { ask: (target: T) => void; dialog: React.ReactNode } {
  const [target, setTarget] = useState<T | null>(null);

  return {
    ask: setTarget,
    dialog:
      target === null ? null : (
        <ConfirmDialog
          open
          title={options.title(target)}
          body={options.body(target)}
          {...(options.confirmLabel ? { confirmLabel: options.confirmLabel } : {})}
          {...(options.pending === undefined ? {} : { pending: options.pending })}
          onCancel={() => setTarget(null)}
          onConfirm={() => {
            void Promise.resolve(options.onConfirm(target)).finally(() => setTarget(null));
          }}
        />
      ),
  };
}
