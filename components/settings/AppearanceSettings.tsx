'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type ThemePref } from '@/lib/store/theme';

const OPTIONS: { key: ThemePref; label: string; icon: typeof Sun; hint: string }[] = [
  { key: 'system', label: 'System', icon: Monitor, hint: 'Follow your OS setting' },
  { key: 'light', label: 'Light', icon: Sun, hint: 'Neutral light' },
  { key: 'dark', label: 'Dark', icon: Moon, hint: 'Neutral dark' },
];

export function AppearanceSettings() {
  const pref = useTheme((s) => s.pref);
  const setPref = useTheme((s) => s.setPref);

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-base font-semibold text-[var(--fg)]">Appearance</h3>

      <div>
        <div className="mb-2 text-sm font-medium text-[var(--fg)]">Theme</div>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            const active = pref === o.key;
            return (
              <button
                key={o.key}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm transition ${
                  active
                    ? 'border-[var(--fg)] bg-[var(--bg-hover)] text-[var(--fg)]'
                    : 'border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)]'
                }`}
                onClick={() => setPref(o.key)}
              >
                <Icon size={20} />
                {o.label}
                <span className="text-xs text-[var(--fg-subtle)]">{o.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-sm text-[var(--fg-muted)]">
        Density is compact by default: 15px base, 1.6 line-height. Motion respects your
        <span className="text-[var(--fg)]"> prefers-reduced-motion </span>
        setting.
      </p>
    </div>
  );
}
