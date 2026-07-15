'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, FileText, Trash2, BookOpen } from 'lucide-react';
import { useChat, useInvalidate, qk, api } from '@/lib/client/hooks';
import { useUi } from '@/lib/store/ui';
import type { DocumentRow } from '@/lib/types';
import { LorebookModal } from '@/components/lorebook/LorebookModal';

export function MemoryTab({ chatId }: { chatId: string }) {
  const { data } = useChat(chatId);
  const invalidate = useInvalidate();
  const pushToast = useUi((s) => s.pushToast);
  const chat = data?.chat;
  const ref = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [lorebookOpen, setLorebookOpen] = useState(false);

  const docsQuery = useQuery({
    queryKey: qk.documents(chatId),
    queryFn: () =>
      api.apiGet<{ documents: DocumentRow[] }>(`/api/rag/documents?chatId=${chatId}`).then((d) => d.documents),
  });

  const toggleRag = (enabled: boolean) =>
    api.apiSend(`/api/chats/${chatId}`, 'PATCH', { rag_enabled: enabled }).then(() => invalidate([qk.chat(chatId)]));

  const upload = async (file: File) => {
    setProgress('Starting…');
    const form = new FormData();
    form.append('file', file);
    form.append('chatId', chatId);
    const res = await fetch('/api/rag/index', { method: 'POST', body: form });
    if (!res.body) {
      setProgress(null);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const line = buffer.slice(0, idx).split('\n').find((l) => l.startsWith('data:'));
        buffer = buffer.slice(idx + 2);
        if (!line) continue;
        try {
          const p = JSON.parse(line.slice(5).trim()) as {
            stage: string;
            completed?: number;
            total?: number;
            message?: string;
          };
          if (p.stage === 'error') {
            pushToast(p.message ?? 'Indexing failed', 'error');
            setProgress(null);
          } else if (p.stage === 'done') {
            setProgress(null);
            pushToast('Document indexed', 'success');
            docsQuery.refetch();
          } else {
            setProgress(`${p.stage} ${p.completed ?? 0}/${p.total ?? 0}`);
          }
        } catch {
          /* ignore */
        }
      }
    }
  };

  const removeDoc = async (id: string) => {
    await fetch(`/api/rag/documents?id=${id}`, { method: 'DELETE' });
    docsQuery.refetch();
  };

  if (!chat) return null;

  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="mb-2 flex items-center gap-2">
          <BookOpen size={15} className="text-[var(--fg-muted)]" />
          <span className="text-sm font-medium text-[var(--fg)]">Lorebook</span>
        </div>
        <button className="btn btn-ghost btn-sm w-full justify-start" onClick={() => setLorebookOpen(true)}>
          Manage world info entries
        </button>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--fg)]">RAG (documents)</span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm"
            checked={chat.rag_enabled === 1}
            onChange={(e) => toggleRag(e.target.checked)}
          />
        </div>
        <p className="mb-2 text-xs text-[var(--fg-subtle)]">
          Off by default. Retrieval costs tokens and rarely helps short scenes.
        </p>
        <button
          className="btn btn-ghost btn-sm w-full justify-start gap-2"
          onClick={() => ref.current?.click()}
          disabled={!!progress}
        >
          <Upload size={14} /> {progress ?? 'Upload document (txt, md, pdf)'}
        </button>
        <input
          ref={ref}
          type="file"
          accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
        <ul className="mt-2 flex flex-col gap-1">
          {(docsQuery.data ?? []).map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
            >
              <FileText size={14} className="text-[var(--fg-subtle)]" />
              <span className="flex-1 truncate text-[var(--fg)]">{d.filename}</span>
              <button
                className="btn btn-ghost btn-xs btn-circle text-[var(--destructive)]"
                onClick={() => removeDoc(d.id)}
                aria-label="Delete document"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <LorebookModal
        open={lorebookOpen}
        onClose={() => setLorebookOpen(false)}
        characterId={chat.character_id}
      />
    </div>
  );
}
