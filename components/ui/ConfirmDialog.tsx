'use client';

import { create } from 'zustand';
import { Modal } from './Modal';

interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((v: boolean) => void) | null;
  ask: (options: ConfirmOptions) => Promise<boolean>;
  close: (v: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  ask: (options) =>
    new Promise<boolean>((resolve) => set({ open: true, options, resolve })),
  close: (v) => {
    get().resolve?.(v);
    set({ open: false, options: null, resolve: null });
  },
}));

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().ask(options);
}

export function ConfirmHost() {
  const { open, options, close } = useConfirmStore();
  if (!options) return null;
  return (
    <Modal
      open={open}
      onClose={() => close(false)}
      title={options.title}
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={() => close(false)}>
            Cancel
          </button>
          <button
            className={`btn btn-sm ${options.destructive ? 'btn-error' : 'btn-primary'}`}
            onClick={() => close(true)}
          >
            {options.confirmLabel ?? 'Confirm'}
          </button>
        </>
      }
    >
      <p className="text-sm text-[var(--fg-muted)] whitespace-pre-line">{options.body}</p>
    </Modal>
  );
}
