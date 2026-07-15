'use client';

import { useEffect, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { usePromptOrder, useInvalidate, qk, api } from '@/lib/client/hooks';
import { useUi } from '@/lib/store/ui';

const LABELS: Record<string, string> = {
  system_prompt: 'System prompt',
  character: 'Character (description, personality, scenario)',
  persona: 'Persona description',
  author_note_system: "Author's Note (system position)",
  lorebook: 'Lorebook entries',
  rag: 'RAG chunks',
  example_messages: 'Example messages',
  chat_history: 'Chat history',
  author_note_depth: "Author's Note @ depth",
  post_history: 'Post-history instructions',
  director: 'Director directive (ephemeral)',
};

export function PromptOrderSettings() {
  const { data } = usePromptOrder();
  const invalidate = useInvalidate();
  const pushToast = useUi((s) => s.pushToast);
  const [order, setOrder] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (data) setOrder(data);
  }, [data]);

  const commit = async (next: string[]) => {
    setOrder(next);
    await api.apiSend('/api/settings/prompt-order', 'PATCH', { order: next });
    invalidate([qk.promptOrder]);
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    if (item) next.splice(to, 0, item);
    commit(next);
  };

  return (
    <div>
      <h3 className="mb-1 text-base font-semibold text-[var(--fg)]">Prompt order</h3>
      <p className="mb-4 text-sm text-[var(--fg-muted)]">
        Drag to reorder how blocks are assembled. Chat history is truncated from the oldest first;
        system, character, persona, and the director directive are never dropped.
      </p>
      <ul className="flex flex-col gap-1">
        {order.map((key, i) => (
          <li
            key={key}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, i);
              setDragIndex(null);
            }}
            className={`flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 ${
              dragIndex === i ? 'opacity-50' : ''
            }`}
          >
            <GripVertical size={15} className="cursor-grab text-[var(--fg-subtle)]" />
            <span className="text-xs tabular-nums text-[var(--fg-subtle)]">{i + 1}</span>
            <span className="text-sm text-[var(--fg)]">{LABELS[key] ?? key}</span>
          </li>
        ))}
      </ul>
      <button
        className="btn btn-ghost btn-sm mt-3"
        onClick={() => {
          commit(Object.keys(LABELS));
          pushToast('Reset to default order', 'info');
        }}
      >
        Reset to default
      </button>
    </div>
  );
}
