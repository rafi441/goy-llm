'use client';

import { ScanEye, Trash2 } from 'lucide-react';
import { MarkdownMessage } from './MarkdownMessage';
import { renderMacros } from '@/lib/prompt/macros';
import type { Message } from '@/lib/types';

export function DescribeCard({
  message,
  characterName,
  userName,
  onDelete,
}: {
  message: Message;
  characterName: string;
  userName: string;
  onDelete: () => void;
}) {
  const content = renderMacros(message.swipes[message.swipe_index] ?? '', characterName, userName);
  return (
    <div className="group py-3">
      <div className="rounded-xl border border-dashed border-[var(--color-info)]/40 bg-[var(--color-info)]/5 px-4 py-2.5">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-info)]">
          <ScanEye size={13} />
          Describe
        </div>
        <div className="text-sm text-[var(--fg-muted)]">
          <MarkdownMessage content={content} />
        </div>
      </div>
      <div className="mt-1 flex justify-end opacity-0 transition group-hover:opacity-100">
        <button
          className="btn btn-ghost btn-xs btn-circle text-[var(--fg-subtle)] hover:text-[var(--destructive)]"
          onClick={onDelete}
          aria-label="Delete description"
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
