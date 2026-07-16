'use client';

import { useRouter } from 'next/navigation';
import { Menu, ScrollText, SlidersHorizontal, MoreVertical, Archive, Trash2, Download } from 'lucide-react';
import { useChat, useInvalidate, qk, api } from '@/lib/client/hooks';
import { ModelPicker } from '@/components/models/ModelPicker';
import { useUi } from '@/lib/store/ui';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

export function Header({ chatId }: { chatId: string | null }) {
  const { data } = useChat(chatId);
  const router = useRouter();
  const invalidate = useInvalidate();
  const setMobileOpen = useUi((s) => s.setSidebarMobile);
  const toggleDrawer = useUi((s) => s.toggleDrawer);
  const drawerOpen = useUi((s) => s.drawerOpen);
  const setInspectorOpen = useUi((s) => s.setInspectorOpen);

  const selectModel = async (connectionId: string, modelId: string) => {
    if (!chatId) return;
    await api.apiSend(`/api/chats/${chatId}`, 'PATCH', { connection_id: connectionId, model_id: modelId });
    invalidate([qk.chat(chatId), qk.chats]);
  };

  const archive = async () => {
    if (!chatId) return;
    await api.apiSend(`/api/chats/${chatId}`, 'PATCH', { archived: !data?.chat.archived });
    invalidate([qk.chats, qk.chat(chatId)]);
  };

  const remove = async () => {
    if (!chatId) return;
    const ok = await confirmDialog({
      title: 'Delete chat',
      body: 'Move this chat to trash? It stays recoverable for 30 days.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await api.apiSend(`/api/chats/${chatId}`, 'DELETE');
    invalidate([qk.chats]);
    router.push('/');
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-[var(--border)] bg-[var(--bg)] px-2 sm:h-14 sm:px-3">
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
        <span className="px-2 text-base font-semibold tracking-tight text-[var(--fg)]">GoyLLM</span>
      )}

      <div className="ml-auto flex items-center gap-0.5">
        {chatId && (
          <>
            <button
              className="btn btn-ghost btn-sm gap-1.5 text-[var(--fg-muted)]"
              onClick={() => setInspectorOpen(true)}
              title="Prompt Inspector"
            >
              <ScrollText size={17} />
              <span className="hidden sm:inline">Inspect</span>
            </button>
            <button
              className={`btn btn-sm btn-circle ${drawerOpen ? 'bg-[var(--bg-hover)]' : 'btn-ghost'} text-[var(--fg-muted)]`}
              onClick={toggleDrawer}
              aria-label="Controls"
              title="Controls — notes, model, persona, memory"
            >
              <SlidersHorizontal size={18} />
            </button>
            <div className="dropdown dropdown-end">
              <button tabIndex={0} className="btn btn-ghost btn-sm btn-circle text-[var(--fg-muted)]" aria-label="Chat menu">
                <MoreVertical size={18} />
              </button>
              <ul
                tabIndex={0}
                className="dropdown-content menu z-40 w-48 rounded-box border border-[var(--border)] bg-[var(--bg-elevated)] p-1 shadow-xl"
              >
                <li>
                  <a href={`/api/chats/${chatId}/export?format=jsonl`} download className="flex items-center gap-2">
                    <Download size={15} /> Export JSONL
                  </a>
                </li>
                <li>
                  <button className="flex items-center gap-2" onClick={archive}>
                    <Archive size={15} /> {data?.chat.archived ? 'Unarchive' : 'Archive'}
                  </button>
                </li>
                <li>
                  <button className="flex items-center gap-2 text-[var(--destructive)]" onClick={remove}>
                    <Trash2 size={15} /> Delete
                  </button>
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
