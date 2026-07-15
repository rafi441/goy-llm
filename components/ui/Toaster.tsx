'use client';

import { useEffect } from 'react';
import { CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { useUi } from '@/lib/store/ui';

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);

  return (
    <div className="toast toast-end z-[100] p-4">
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} message={t.message} kind={t.kind} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  id,
  message,
  kind,
  onDismiss,
}: {
  id: number;
  message: string;
  kind: 'info' | 'success' | 'error';
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), kind === 'error' ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [id, kind, onDismiss]);

  const Icon = kind === 'success' ? CheckCircle2 : kind === 'error' ? XCircle : Info;
  const color =
    kind === 'success' ? 'text-success' : kind === 'error' ? 'text-error' : 'text-primary';

  return (
    <div className="alert max-w-sm border border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg">
      <Icon size={18} className={color} />
      <span className="text-sm text-[var(--fg)]">{message}</span>
      <button className="btn btn-ghost btn-xs btn-circle" onClick={() => onDismiss(id)} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}
