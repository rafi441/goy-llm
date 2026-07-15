'use client';

import { Avatar } from '@/components/ui/Avatar';

const DEFAULT_STARTERS = [
  'Set the scene and introduce yourself.',
  'Describe where we are right now.',
  '*I walk in and look around.*',
  'What are you thinking about?',
];

export function EmptyChat({
  characterName,
  avatarPath,
  greetings,
  onPick,
}: {
  characterName: string;
  avatarPath?: string | null;
  greetings: string[];
  onPick: (text: string) => void;
}) {
  const starters = greetings.length > 0 ? greetings.slice(0, 4) : DEFAULT_STARTERS;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <Avatar path={avatarPath ?? null} name={characterName} size={64} />
      <h2 className="mb-8 mt-4 text-2xl font-semibold text-[var(--fg)]">{characterName}</h2>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {starters.map((s, i) => (
          <button
            key={i}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-left text-sm text-[var(--fg-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
            onClick={() => onPick(s)}
            title={s}
          >
            <span className="line-clamp-2">{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
