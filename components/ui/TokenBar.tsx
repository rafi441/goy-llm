'use client';

interface TokenBarProps {
  used: number;
  budget: number;
  compact?: boolean;
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function TokenBar({ used, budget, compact }: TokenBarProps) {
  const ratio = budget > 0 ? used / budget : 0;
  const pct = Math.min(100, ratio * 100);
  const color =
    ratio >= 0.95 ? 'var(--destructive)' : ratio >= 0.8 ? 'var(--color-warning)' : 'var(--primary)';

  return (
    <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--bg-hover)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={`tabular-nums text-[var(--fg-subtle)] ${compact ? 'hidden sm:inline' : ''}`}>
        {fmt(used)} / {fmt(budget)}
      </span>
    </div>
  );
}
