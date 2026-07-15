'use client';

import { Clapperboard, Pin, PinOff, Trash2 } from 'lucide-react';
import type { Message } from '@/lib/types';

export function DirectiveCard({
  message,
  onTogglePin,
  onDelete,
}: {
  message: Message;
  onTogglePin: (pinned: boolean) => void;
  onDelete: () => void;
}) {
  const content = message.swipes[message.swipe_index] ?? '';
  const pinned = message.pinned_directive === 1;
  return (
    <div className="group py-3">
      <div className="flex w-full items-start gap-2 rounded-lg border border-dashed border-[var(--border)] bg-transparent px-4 py-2.5 text-sm italic text-[var(--fg-muted)]">
        <Clapperboard size={15} className="mt-0.5 shrink-0 text-[var(--primary)]" />
        <span className="flex-1 whitespace-pre-wrap">{content}</span>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button
            className="btn btn-ghost btn-xs btn-circle"
            onClick={() => onTogglePin(!pinned)}
            title={pinned ? 'Unpin' : 'Pin (keep in context)'}
          >
            {pinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
          <button
            className="btn btn-ghost btn-xs btn-circle text-[var(--destructive)]"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
