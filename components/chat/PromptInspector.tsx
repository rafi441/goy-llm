'use client';

import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { TokenBar } from '@/components/ui/TokenBar';
import { useUi } from '@/lib/store/ui';
import { api } from '@/lib/client/hooks';
import type { ProviderMessage, PromptBlock } from '@/lib/types';

interface InspectorPayload {
  messages: ProviderMessage[];
  blocks: PromptBlock[];
  totalTokens: number;
  budget: number;
  truncatedAt: string | null;
  activeLorebookEntries: { id: string; keys: string[]; tokens: number }[];
  modelId: string | null;
  genConfig: Record<string, unknown>;
}

export function PromptInspector({ chatId }: { chatId: string }) {
  const open = useUi((s) => s.inspectorOpen);
  const setOpen = useUi((s) => s.setInspectorOpen);

  const { data, isLoading, error } = useQuery({
    queryKey: ['inspector', chatId, open],
    enabled: open,
    queryFn: () => api.apiGet<InspectorPayload>(`/api/chats/${chatId}/prompt`),
  });

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Prompt Inspector" size="xl">
      {isLoading && <p className="text-sm text-[var(--fg-subtle)]">Building prompt…</p>}
      {error && <p className="text-sm text-[var(--destructive)]">{(error as Error).message}</p>}
      {data && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
            <div className="text-sm text-[var(--fg-muted)]">
              Model: <span className="text-[var(--fg)]">{data.modelId ?? '—'}</span>
            </div>
            <TokenBar used={data.totalTokens} budget={data.budget} />
          </div>

          {data.activeLorebookEntries.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-medium uppercase text-[var(--fg-subtle)]">
                Active lorebook ({data.activeLorebookEntries.length})
              </h3>
              <div className="flex flex-wrap gap-1">
                {data.activeLorebookEntries.map((e) => (
                  <span key={e.id} className="badge badge-sm border-[var(--border)] bg-[var(--bg-hover)]">
                    {e.keys.slice(0, 2).join(', ')} · {e.tokens}t
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-1 text-xs font-medium uppercase text-[var(--fg-subtle)]">Blocks</h3>
            <div className="flex flex-col gap-1">
              {data.blocks.map((b, i) => (
                <details key={i} className="rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                  <summary className="flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="badge badge-xs">{b.role}</span>
                      <span className="text-[var(--fg)]">{b.label}</span>
                      {b.ephemeral && <span className="text-xs text-[var(--primary)]">ephemeral</span>}
                    </span>
                    <span className="tabular-nums text-xs text-[var(--fg-subtle)]">{b.tokens}t</span>
                  </summary>
                  <pre className="scrollbar-thin max-h-48 overflow-auto whitespace-pre-wrap px-3 py-2 text-xs text-[var(--fg-muted)]">
                    {b.content}
                  </pre>
                </details>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-xs font-medium uppercase text-[var(--fg-subtle)]">
              Final payload (as sent upstream)
            </h3>
            <pre className="scrollbar-thin max-h-72 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--fg-muted)]">
              {JSON.stringify({ messages: data.messages, ...data.genConfig }, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </Modal>
  );
}
