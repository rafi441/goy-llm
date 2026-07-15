'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Upload, RotateCcw, Trash2 } from 'lucide-react';
import { qk, api } from '@/lib/client/hooks';
import { useUi } from '@/lib/store/ui';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import type { ChatListItem } from '@/lib/db/repos/chats';

export function DataBackupSettings() {
  const pushToast = useUi((s) => s.pushToast);
  const [restoring, setRestoring] = useState(false);

  const trash = useQuery({
    queryKey: qk.trash,
    queryFn: () => api.apiGet<{ chats: ChatListItem[] }>('/api/trash').then((d) => d.chats),
  });

  const restoreBackup = async (file: File) => {
    const ok = await confirmDialog({
      title: 'Restore database',
      body: 'This replaces the entire current database. All current data will be overwritten. Continue?',
      confirmLabel: 'Restore',
      destructive: true,
    });
    if (!ok) return;
    setRestoring(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/backup', { method: 'POST', body: form });
    setRestoring(false);
    if (res.ok) {
      pushToast('Database restored — reloading', 'success');
      setTimeout(() => window.location.reload(), 800);
    } else {
      pushToast('Restore failed', 'error');
    }
  };

  const trashAction = async (action: string, chatId?: string) => {
    await api.apiSend('/api/trash', 'POST', { action, chatId });
    trash.refetch();
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-base font-semibold text-[var(--fg)]">Backup & restore</h3>
        <p className="mb-3 text-sm text-[var(--fg-muted)]">
          The whole database — chats, characters, connections — as a single file.
        </p>
        <div className="flex gap-2">
          <a className="btn btn-sm gap-1.5 bg-[var(--bg-elevated)]" href="/api/backup" download>
            <Download size={14} /> Download backup
          </a>
          <label className="btn btn-sm cursor-pointer gap-1.5 bg-[var(--bg-elevated)]">
            <Upload size={14} /> {restoring ? 'Restoring…' : 'Restore'}
            <input
              type="file"
              accept=".db,application/octet-stream"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && restoreBackup(e.target.files[0])}
            />
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-base font-semibold text-[var(--fg)]">Trash</h3>
        <p className="mb-3 text-sm text-[var(--fg-muted)]">Deleted chats are kept for 30 days.</p>
        {(trash.data ?? []).length === 0 ? (
          <p className="text-sm text-[var(--fg-subtle)]">Trash is empty.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {(trash.data ?? []).map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm"
              >
                <span className="flex-1 truncate text-[var(--fg)]">{c.title}</span>
                <button
                  className="btn btn-ghost btn-xs gap-1"
                  onClick={() => trashAction('restore', c.id)}
                >
                  <RotateCcw size={12} /> Restore
                </button>
                <button
                  className="btn btn-ghost btn-xs btn-circle text-[var(--destructive)]"
                  onClick={() => trashAction('purge', c.id)}
                  aria-label="Delete forever"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
