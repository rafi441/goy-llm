'use client';

import { useEffect, useState } from 'react';
import { useChat, useInvalidate, qk, api } from '@/lib/client/hooks';
import { useDebouncedValue } from '@/lib/client/useDebounced';
import type { AuthorNotePosition } from '@/lib/types';

export function NotesTab({ chatId }: { chatId: string }) {
  const { data } = useChat(chatId);
  const invalidate = useInvalidate();
  const chat = data?.chat;

  const [note, setNote] = useState('');
  const [position, setPosition] = useState<AuthorNotePosition>('depth');
  const [depth, setDepth] = useState(4);
  const [enabled, setEnabled] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (chat && !hydrated) {
      setNote(chat.author_note);
      setPosition(chat.author_note_position);
      setDepth(chat.author_note_depth);
      setEnabled(chat.author_note_enabled === 1);
      setHydrated(true);
    }
  }, [chat, hydrated]);

  const debouncedNote = useDebouncedValue(note, 500);

  useEffect(() => {
    if (!hydrated || !chat) return;
    if (note !== debouncedNote) return;
    if (debouncedNote === chat.author_note) return;
    api.apiSend(`/api/chats/${chatId}`, 'PATCH', { author_note: debouncedNote }).then(() =>
      invalidate([qk.chat(chatId)]),
    );
  }, [debouncedNote, hydrated, chat, chatId, invalidate]);

  const persist = (body: Record<string, unknown>) =>
    api.apiSend(`/api/chats/${chatId}`, 'PATCH', body).then(() => invalidate([qk.chat(chatId)]));

  if (!chat) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--fg)]">Author&apos;s Note</span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              persist({ author_note_enabled: e.target.checked });
            }}
          />
        </div>
        <textarea
          className="textarea min-h-28 w-full border-[var(--border)] bg-[var(--bg)] text-sm"
          placeholder="Steer the scene, tone, or facts the model should keep in mind…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">Injection position</label>
        <select
          className="select select-sm w-full border-[var(--border)] bg-[var(--bg)]"
          value={position}
          onChange={(e) => {
            const p = e.target.value as AuthorNotePosition;
            setPosition(p);
            persist({ author_note_position: p });
          }}
        >
          <option value="system">System (top)</option>
          <option value="depth">In-chat @ depth</option>
          <option value="after">After last message</option>
        </select>
      </div>

      {position === 'depth' && (
        <div>
          <label className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">Depth</label>
          <input
            type="number"
            min={0}
            max={50}
            className="input input-sm w-24 border-[var(--border)] bg-[var(--bg)]"
            value={depth}
            onChange={(e) => {
              const d = Number(e.target.value);
              setDepth(d);
              persist({ author_note_depth: d });
            }}
          />
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">
            Insert {depth} messages from the end — deeper wins recency.
          </p>
        </div>
      )}

      <button
        className="btn btn-ghost btn-sm justify-start text-[var(--fg-muted)]"
        onClick={() => {
          setPosition('system');
          persist({ author_note_position: 'system' });
        }}
      >
        Use as Session Rules (system position)
      </button>
    </div>
  );
}
