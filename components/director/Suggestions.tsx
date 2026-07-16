'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { api } from '@/lib/client/hooks';
import { useUi } from '@/lib/store/ui';

export function Suggestions({
  chatId,
  onPick,
}: {
  chatId: string;
  onPick: (text: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const pushToast = useUi((s) => s.pushToast);
  const mode = useUi((s) => s.playMode);

  // clear stale suggestions when the play mode changes — they no longer match the role
  useEffect(() => setSuggestions([]), [mode]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.apiSend<{ suggestions: string[] }>('/api/suggest', 'POST', { chatId, mode });
      setSuggestions(res.suggestions);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Could not get suggestions', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className="btn btn-ghost btn-sm btn-circle text-[var(--fg-muted)]"
        onClick={load}
        disabled={loading}
        aria-label="Suggest next actions"
        title="Suggest next actions"
      >
        <Sparkles size={18} className={loading ? 'animate-pulse' : ''} />
      </button>

      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-2 flex flex-wrap items-center gap-1.5 px-1">
          {suggestions.map((s, i) => (
            <button
              key={i}
              className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--fg-muted)] hover:border-[var(--primary)] hover:text-[var(--fg)]"
              onClick={() => {
                onPick(s);
                setSuggestions([]);
              }}
            >
              {s}
            </button>
          ))}
          <button
            className="btn btn-ghost btn-xs btn-circle"
            onClick={() => setSuggestions([])}
            aria-label="Dismiss suggestions"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </>
  );
}
