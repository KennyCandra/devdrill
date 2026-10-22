import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './ui';

/**
 * A small modal built on <dialog>: the browser handles focus trapping, Escape and the
 * backdrop. The cancel button gets focus first so Enter never confirms by accident.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[360px] rounded-md border border-line-strong bg-side p-4 text-fg backdrop:bg-black/50"
    >
      <h2 id="confirm-title" className="mb-2 text-[14px] font-semibold">
        {title}
      </h2>
      <div className="mb-4 leading-relaxed text-muted">{children}</div>
      <div className="flex justify-end gap-2">
        <Button ref={cancelRef} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
