'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  bodyClassName?: string;
}

const sizeClass: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export function Modal({ open, onClose, title, children, footer, size = 'md', bodyClassName }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className={`modal-box flex max-h-[85dvh] w-full flex-col overflow-hidden border border-[var(--border)] bg-[var(--bg-elevated)] p-0 ${sizeClass[size]}`}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5 sm:px-5 sm:py-3">
            <h2 className="text-base font-semibold text-[var(--fg)]">{title}</h2>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className={`scrollbar-thin flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4 ${bodyClassName ?? ''}`}>
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-2.5 sm:px-5 sm:py-3">
            {footer}
          </div>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
