'use client';

import { X, StickyNote, SlidersHorizontal, User, Brain } from 'lucide-react';
import { useUi, type DrawerTab } from '@/lib/store/ui';
import { NotesTab } from '@/components/drawer/NotesTab';
import { ModelConfigTab } from '@/components/drawer/ModelConfigTab';
import { PersonaTab } from '@/components/drawer/PersonaTab';
import { MemoryTab } from '@/components/drawer/MemoryTab';

const TABS: { key: DrawerTab; label: string; icon: typeof StickyNote }[] = [
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'model', label: 'Model', icon: SlidersHorizontal },
  { key: 'persona', label: 'Persona', icon: User },
  { key: 'memory', label: 'Memory', icon: Brain },
];

export function Drawer({ chatId }: { chatId: string | null }) {
  const open = useUi((s) => s.drawerOpen);
  const setOpen = useUi((s) => s.setDrawerOpen);
  const tab = useUi((s) => s.drawerTab);
  const setTab = useUi((s) => s.setDrawerTab);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/40 xl:hidden"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside className="fixed right-0 top-0 z-40 flex h-dvh w-[360px] max-w-[92vw] flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--bg)] shadow-2xl xl:static xl:z-auto xl:h-full xl:shadow-none">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <span className="text-sm font-semibold text-[var(--fg)]">Controls</span>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setOpen(false)} aria-label="Close panel">
            <X size={16} />
          </button>
        </div>

        <div role="tablist" className="grid grid-cols-4 gap-1 border-b border-[var(--border)] p-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                className={`flex flex-col items-center gap-1 rounded-xl py-2 text-xs transition ${
                  active
                    ? 'bg-[var(--bg-hover)] text-[var(--fg)]'
                    : 'text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)]'
                }`}
                onClick={() => setTab(t.key)}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden p-4">
          {!chatId ? (
            <p className="py-8 text-center text-sm text-[var(--fg-subtle)]">Open a chat to use this panel.</p>
          ) : tab === 'notes' ? (
            <NotesTab chatId={chatId} />
          ) : tab === 'model' ? (
            <ModelConfigTab chatId={chatId} />
          ) : tab === 'persona' ? (
            <PersonaTab chatId={chatId} />
          ) : (
            <MemoryTab chatId={chatId} />
          )}
        </div>
      </aside>
    </>
  );
}
