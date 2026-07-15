'use client';

import { Menu, PanelRight, ScrollText, Sparkles } from 'lucide-react';
import { useChat, useInvalidate, qk, api } from '@/lib/client/hooks';
import { ModelPicker } from '@/components/models/ModelPicker';
import { useUi } from '@/lib/store/ui';

export function Header({ chatId }: { chatId: string | null }) {
  const { data } = useChat(chatId);
  const invalidate = useInvalidate();
  const setMobileOpen = useUi((s) => s.setSidebarMobile);
  const toggleDrawer = useUi((s) => s.toggleDrawer);
  const setInspectorOpen = useUi((s) => s.setInspectorOpen);

  const selectModel = async (connectionId: string, modelId: string) => {
    if (!chatId) return;
    await api.apiSend(`/api/chats/${chatId}`, 'PATCH', { connection_id: connectionId, model_id: modelId });
    invalidate([qk.chat(chatId), qk.chats]);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2">
      <button
        className="btn btn-ghost btn-sm btn-circle md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu size={18} />
      </button>

      {chatId ? (
        <ModelPicker
          connectionId={data?.chat.connection_id ?? null}
          modelId={data?.chat.model_id ?? null}
          onSelect={selectModel}
        />
      ) : (
        <span className="px-2 text-sm font-medium text-[var(--fg-muted)]">GoyLLM</span>
      )}

      <div className="ml-auto flex items-center gap-1">
        {chatId && (
          <button
            className="btn btn-ghost btn-sm gap-1.5 text-[var(--fg-muted)]"
            onClick={() => setInspectorOpen(true)}
            title="Prompt Inspector"
          >
            <ScrollText size={16} />
            <span className="hidden sm:inline">Inspect</span>
          </button>
        )}
        <button
          className="btn btn-ghost btn-sm btn-circle text-[var(--fg-muted)]"
          onClick={toggleDrawer}
          aria-label="Toggle panel"
          title="Notes, model, persona, memory"
        >
          <PanelRight size={18} />
        </button>
      </div>
    </header>
  );
}
