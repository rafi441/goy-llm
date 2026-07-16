'use client';

import { User, Drama, BookOpen, ChevronDown, Check } from 'lucide-react';
import { useUi } from '@/lib/store/ui';
import type { PlayMode } from '@/lib/types';

const MODES: { key: PlayMode; label: string; icon: typeof User; hint: string }[] = [
  { key: 'as_user', label: 'As User', icon: User, hint: 'Speak as yourself, then generate' },
  { key: 'as_char', label: 'As Character', icon: Drama, hint: 'Write for the character' },
  { key: 'narrator', label: 'Narrator', icon: BookOpen, hint: 'Neutral scene narration' },
];

export function ModeChips() {
  const mode = useUi((s) => s.playMode);
  const setMode = useUi((s) => s.setPlayMode);
  const active = MODES.find((m) => m.key === mode) ?? MODES[0]!;
  const ActiveIcon = active.icon;

  return (
    <div className="dropdown dropdown-top">
      <button
        tabIndex={0}
        className="flex items-center gap-1.5 rounded-full bg-[var(--bg)] px-2.5 py-1.5 text-xs text-[var(--fg)] hover:bg-[var(--bg-hover)]"
        aria-label={`Play mode: ${active.label}`}
        title="Play mode"
      >
        <ActiveIcon size={14} />
        <span className="hidden sm:inline">{active.label}</span>
        <ChevronDown size={13} className="text-[var(--fg-subtle)]" />
      </button>
      <ul
        tabIndex={0}
        className="dropdown-content menu z-40 mb-2 w-56 rounded-box border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 shadow-xl"
      >
        <li className="menu-title px-2 py-1 text-xs text-[var(--fg-subtle)]">Play as</li>
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = m.key === mode;
          return (
            <li key={m.key}>
              <button
                className="flex items-center gap-2.5"
                onClick={() => {
                  setMode(m.key);
                  (document.activeElement as HTMLElement | null)?.blur();
                }}
              >
                <Icon size={16} className="shrink-0" />
                <span className="flex-1">
                  <span className="block text-sm text-[var(--fg)]">{m.label}</span>
                  <span className="block text-xs text-[var(--fg-subtle)]">{m.hint}</span>
                </span>
                {isActive && <Check size={15} className="shrink-0 text-[var(--fg)]" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
