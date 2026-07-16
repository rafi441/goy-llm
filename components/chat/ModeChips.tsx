'use client';

import { User, Drama, BookOpen } from 'lucide-react';
import { useUi } from '@/lib/store/ui';
import type { PlayMode } from '@/lib/types';

const MODES: { key: PlayMode; label: string; icon: typeof User; hint: string }[] = [
  { key: 'as_user', label: 'As User', icon: User, hint: 'Speak as yourself, then generate (Ctrl+1)' },
  { key: 'as_char', label: 'As Character', icon: Drama, hint: 'Write for the character — adds, no generation (Ctrl+2)' },
  { key: 'narrator', label: 'Narrator', icon: BookOpen, hint: 'Neutral narration (Ctrl+3)' },
];

export function ModeChips() {
  const mode = useUi((s) => s.playMode);
  const setMode = useUi((s) => s.setPlayMode);
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-[var(--bg)] p-0.5">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition ${
              active
                ? 'bg-[var(--bg-elevated)] text-[var(--fg)] shadow-sm'
                : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
            }`}
            onClick={() => setMode(m.key)}
            title={m.hint}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
