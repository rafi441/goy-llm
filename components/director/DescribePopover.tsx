'use client';

import { useEffect, useRef, useState } from 'react';
import { ScanEye } from 'lucide-react';
import { useInvalidate, qk, api } from '@/lib/client/hooks';
import { useUi } from '@/lib/store/ui';
import { DESCRIBE_ASPECTS } from '@/lib/prompt/describe';

export function DescribePopover({ chatId }: { chatId: string }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const invalidate = useInvalidate();
  const mode = useUi((s) => s.playMode);
  const pushToast = useUi((s) => s.pushToast);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const fire = async (aspect: string) => {
    if (!aspect.trim() || loading) return;
    setLoading(true);
    try {
      await api.apiSend(`/api/describe`, 'POST', { chatId, aspect: aspect.trim(), mode });
      invalidate([qk.messages(chatId), qk.chat(chatId)]);
      setCustom('');
      setOpen(false);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Could not describe', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn btn-ghost btn-sm btn-circle text-[var(--fg-muted)]"
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        aria-label="Describe the current situation"
        title="Describe — out-of-character snapshot, not part of the story"
      >
        <ScanEye size={18} className={loading ? 'animate-pulse' : ''} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-40 mb-2 w-72 rounded-box border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-xl">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
            <ScanEye size={15} className="text-[var(--color-info)]" /> Describe
          </div>
          <p className="mb-2 text-xs text-[var(--fg-subtle)]">
            An out-of-character snapshot of the current situation. Not sent to the model — it never
            changes the story.
          </p>
          <div className="mb-2 flex flex-wrap gap-1">
            {DESCRIBE_ASPECTS.map((a) => (
              <button
                key={a}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--fg-muted)] hover:border-[var(--color-info)] disabled:opacity-50"
                onClick={() => fire(a)}
                disabled={loading}
              >
                {a}
              </button>
            ))}
          </div>
          <input
            className="input input-sm w-full border-[var(--border)] bg-[var(--bg)]"
            placeholder="Custom aspect, e.g. injuries…"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fire(custom);
            }}
            disabled={loading}
          />
        </div>
      )}
    </div>
  );
}
