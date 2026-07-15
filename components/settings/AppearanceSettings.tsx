'use client';

export function AppearanceSettings() {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-semibold text-[var(--fg)]">Appearance</h3>
      <div className="rounded-lg border border-[var(--border)] p-4">
        <div className="mb-2 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full" style={{ background: 'var(--primary)' }} />
          <div>
            <div className="text-sm font-medium text-[var(--fg)]">Dark Violet</div>
            <div className="text-xs text-[var(--fg-subtle)]">
              The single built-in theme. Accent used sparingly, WCAG AA contrast.
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          {['var(--bg)', 'var(--bg-sidebar)', 'var(--bg-elevated)', 'var(--bg-user-msg)', 'var(--primary)'].map(
            (c) => (
              <div key={c} className="h-6 w-6 rounded border border-[var(--border)]" style={{ background: c }} />
            ),
          )}
        </div>
      </div>
      <p className="text-sm text-[var(--fg-muted)]">
        Density is compact by default: 15px base, 1.65 line-height. Motion respects your
        <span className="text-[var(--fg)]"> prefers-reduced-motion </span>
        setting.
      </p>
    </div>
  );
}
