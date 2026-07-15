'use client';

import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Pin } from 'lucide-react';
import { useInvalidate, qk, api } from '@/lib/client/hooks';

const QUICK_ACTIONS = [
  'Advance the scene',
  'Introduce a complication',
  'Time skip a few hours',
  'Change tone → darker',
  'Change tone → lighter',
  'End the scene',
];

export function DirectorPopover({
  chatId,
  onGenerate,
}: {
  chatId: string;
  onGenerate: (directive: { content: string; strong?: boolean } | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const invalidate = useInvalidate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const fire = async (content: string) => {
    if (!content.trim()) return;
    if (pinned) {
      await api.apiSend(`/api/chats/${chatId}/messages`, 'POST', {
        role: 'system',
        type: 'directive',
        content,
        pinned_directive: true,
      });
      invalidate([qk.messages(chatId)]);
      onGenerate(undefined);
    } else {
      onGenerate({ content });
    }
    setText('');
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn btn-ghost btn-sm btn-circle text-[var(--fg-muted)]"
        onClick={() => setOpen((v) => !v)}
        aria-label="Director tool"
        title="Director — instruct the AI out of character"
      >
        <Clapperboard size={18} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-40 mb-2 w-80 rounded-box border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-xl">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
            <Clapperboard size={15} className="text-[var(--primary)]" /> Director
          </div>
          <p className="mb-2 text-xs text-[var(--fg-subtle)]">
            Out-of-character instruction. Injected at the end of context — never sent as your line.
          </p>
          <div className="mb-2 flex flex-wrap gap-1">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--fg-muted)] hover:border-[var(--primary)]"
                onClick={() => fire(a)}
              >
                {a}
              </button>
            ))}
          </div>
          <textarea
            className="textarea textarea-sm mb-2 w-full border-[var(--border)] bg-[var(--bg)]"
            placeholder="e.g. Alice loses her patience and brings up his past."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) fire(text);
            }}
          />
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--fg-muted)]">
              <input
                type="checkbox"
                className="checkbox checkbox-xs"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              <Pin size={12} /> Pin (persist)
            </label>
            <button className="btn btn-primary btn-sm" onClick={() => fire(text)} disabled={!text.trim()}>
              Direct
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
