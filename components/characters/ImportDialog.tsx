'use client';

import { useState } from 'react';
import { Upload, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useInvalidate, qk } from '@/lib/client/hooks';
import { useUi } from '@/lib/store/ui';

interface ImportResult {
  ok: boolean;
  filename: string;
  warning?: string;
  error?: string;
}

export function ImportDialog() {
  const open = useUi((s) => s.importOpen);
  const setOpen = useUi((s) => s.setImportOpen);
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);

  const upload = async (files: FileList) => {
    setBusy(true);
    setResults([]);
    const form = new FormData();
    for (const f of Array.from(files)) form.append('files', f);
    try {
      const res = await fetch('/api/characters/import', { method: 'POST', body: form });
      const data = (await res.json()) as { results: ImportResult[] };
      setResults(data.results);
      invalidate([qk.characters]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Import character cards" size="md">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-box border border-dashed border-[var(--border)] p-8 text-center hover:border-[var(--primary)]">
        <Upload size={28} className="text-[var(--fg-subtle)]" />
        <span className="text-sm text-[var(--fg-muted)]">
          {busy ? 'Importing…' : 'Drop or choose PNG / JSON cards (V1, V2, V3)'}
        </span>
        <span className="text-xs text-[var(--fg-subtle)]">Up to 10MB each · multiple files supported</span>
        <input
          type="file"
          multiple
          accept=".png,.json,image/png,application/json"
          className="hidden"
          onChange={(e) => e.target.files && e.target.files.length > 0 && upload(e.target.files)}
        />
      </label>

      {results.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1">
          {results.map((r, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            >
              {r.ok ? (
                r.warning ? (
                  <AlertTriangle size={16} className="mt-0.5 text-[var(--color-warning)]" />
                ) : (
                  <CheckCircle2 size={16} className="mt-0.5 text-success" />
                )
              ) : (
                <XCircle size={16} className="mt-0.5 text-[var(--destructive)]" />
              )}
              <div className="min-w-0">
                <div className="truncate text-[var(--fg)]">{r.filename}</div>
                {(r.warning || r.error) && (
                  <div className="text-xs text-[var(--fg-subtle)]">{r.warning ?? r.error}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
