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
      <aside className="fixed right-0 top-0 z-40 flex h-dvh w-[340px] max-w-[90vw] flex-col border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl xl:static xl:z-auto xl:h-full xl:shadow-none">
        <div className="flex items-center gap-1 border-b border-[var(--border)] px-3 py-2">
          <div role="tablist" className="flex min-w-0 flex-1 flex-wrap gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  title={t.label}
                  className={`btn btn-sm shrink-0 gap-1.5 ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTab(t.key)}
                >
                  <Icon size={14} />
                  {tab === t.key && <span>{t.label}</span>}
                </button>
              );
            })}
          </div>
          <button className="btn btn-ghost btn-sm btn-circle shrink-0" onClick={() => setOpen(false)} aria-label="Close panel">
            <X size={16} />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
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
