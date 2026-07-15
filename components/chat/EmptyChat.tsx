'use client';

const DEFAULT_STARTERS = [
  'Set the scene and introduce yourself.',
  'Describe where we are right now.',
  '*I walk in and look around.*',
  'What are you thinking about?',
];

export function EmptyChat({
  characterName,
  greetings,
  onPick,
}: {
  characterName: string;
  greetings: string[];
  onPick: (text: string) => void;
}) {
  const starters = greetings.length > 0 ? greetings.slice(0, 4) : DEFAULT_STARTERS;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <h2 className="mb-6 text-3xl font-semibold text-[var(--fg)]">{characterName}</h2>
      <div className="flex max-w-[46rem] flex-wrap justify-center gap-2">
        {starters.map((s, i) => (
          <button
            key={i}
            className="max-w-xs truncate rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm text-[var(--fg-muted)] transition hover:border-[var(--primary)] hover:text-[var(--fg)]"
            onClick={() => onPick(s)}
            title={s}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
