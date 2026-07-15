'use client';

import { useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Search, Settings, PanelLeftClose, PanelLeft, MoreHorizontal } from 'lucide-react';
import { useChats, useInvalidate, qk, api } from '@/lib/client/hooks';
import { useUi } from '@/lib/store/ui';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import type { ChatListItem } from '@/lib/db/repos/chats';
import { Avatar } from '@/components/ui/Avatar';
import { useDebouncedValue } from '@/lib/client/useDebounced';

const DAY = 86_400_000;

function groupChats(chats: ChatListItem[]): { label: string; items: ChatListItem[] }[] {
  const now = Date.now();
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const buckets = {
    Pinned: [] as ChatListItem[],
    Today: [] as ChatListItem[],
    Yesterday: [] as ChatListItem[],
    'Previous 7 days': [] as ChatListItem[],
    Older: [] as ChatListItem[],
  };
  for (const c of chats) {
    if (c.pinned) buckets.Pinned.push(c);
    else if (c.updated_at >= startOfToday) buckets.Today.push(c);
    else if (c.updated_at >= startOfToday - DAY) buckets.Yesterday.push(c);
    else if (c.updated_at >= now - 7 * DAY) buckets['Previous 7 days'].push(c);
    else buckets.Older.push(c);
  }
  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const activeId = pathname.startsWith('/c/') ? pathname.slice(3) : null;
  const { data: chats = [] } = useChats();
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  const openSettings = useUi((s) => s.openSettings);
  const setMobileOpen = useUi((s) => s.setSidebarMobile);

  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 200);

  const groups = useMemo(() => groupChats(chats), [chats]);
  const filtered = useMemo(() => {
    if (!debounced.trim()) return null;
    const q = debounced.toLowerCase();
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [debounced, chats]);

  if (collapsed) {
    return (
      <aside className="hidden w-[56px] shrink-0 flex-col items-center gap-2 border-r border-[var(--border)] bg-[var(--bg-sidebar)] py-3 md:flex">
        <button className="btn btn-ghost btn-sm btn-circle" onClick={toggle} aria-label="Expand sidebar">
          <PanelLeft size={18} />
        </button>
        <button
          className="btn btn-ghost btn-sm btn-circle"
          onClick={() => router.push('/')}
          aria-label="New chat"
        >
          <Plus size={18} />
        </button>
        <button
          className="btn btn-ghost btn-sm btn-circle mt-auto"
          onClick={() => openSettings()}
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)]">
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          className="btn btn-sm flex-1 justify-start gap-2 border-[var(--border)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]"
          onClick={() => {
            router.push('/');
            setMobileOpen(false);
          }}
        >
          <Plus size={16} /> New chat
        </button>
        <button
          className="btn btn-ghost btn-sm btn-circle hidden md:inline-flex"
          onClick={toggle}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <div className="px-3 pb-2">
        <label className="input input-sm flex items-center gap-2 border-[var(--border)] bg-[var(--bg)]">
          <Search size={14} className="text-[var(--fg-subtle)]" />
          <input
            type="search"
            className="grow"
            placeholder="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-2">
        {filtered ? (
          <ChatGroup
            label={`Results (${filtered.length})`}
            items={filtered}
            activeId={activeId}
            onOpen={(id) => {
              router.push(`/c/${id}`);
              setMobileOpen(false);
            }}
          />
        ) : (
          groups.map((g) => (
            <ChatGroup
              key={g.label}
              label={g.label}
              items={g.items}
              activeId={activeId}
              onOpen={(id) => {
                router.push(`/c/${id}`);
                setMobileOpen(false);
              }}
            />
          ))
        )}
        {chats.length === 0 && !filtered && (
          <p className="px-2 py-6 text-center text-sm text-[var(--fg-subtle)]">No chats yet.</p>
        )}
      </nav>

      <div className="border-t border-[var(--border)] p-2">
        <button
          className="btn btn-ghost btn-sm w-full justify-start gap-2 text-[var(--fg-muted)]"
          onClick={() => openSettings()}
        >
          <Settings size={16} /> Settings
        </button>
      </div>
    </aside>
  );
}

function ChatGroup({
  label,
  items,
  activeId,
  onOpen,
}: {
  label: string;
  items: ChatListItem[];
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="mb-2">
      <div className="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">
        {label}
      </div>
      <ul>
        {items.map((c) => (
          <ChatRow key={c.id} chat={c} active={c.id === activeId} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  );
}

function ChatRow({
  chat,
  active,
  onOpen,
}: {
  chat: ChatListItem;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  const invalidate = useInvalidate();
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(chat.title);

  const patch = async (body: Record<string, unknown>) => {
    await api.apiSend(`/api/chats/${chat.id}`, 'PATCH', body);
    invalidate([qk.chats, qk.chat(chat.id)]);
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: 'Delete chat',
      body: `Move "${chat.title}" to trash? It stays recoverable for 30 days.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await api.apiSend(`/api/chats/${chat.id}`, 'DELETE');
    invalidate([qk.chats]);
    if (active) router.push('/');
  };

  return (
    <li
      className={`group relative flex items-center gap-2 rounded-lg px-2 py-1.5 ${
        active ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-elevated)]'
      }`}
    >
      <Avatar path={chat.avatar_path} name={chat.character_name ?? chat.title} size={22} />
      {renaming ? (
        <input
          autoFocus
          className="input input-xs flex-1 border-[var(--border)] bg-[var(--bg)]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            setRenaming(false);
            if (title.trim() && title !== chat.title) patch({ title: title.trim() });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setTitle(chat.title);
              setRenaming(false);
            }
          }}
        />
      ) : (
        <button
          className="flex-1 truncate text-left text-sm text-[var(--fg)]"
          onClick={() => onOpen(chat.id)}
          title={chat.title}
        >
          {chat.title}
        </button>
      )}

      <div className="dropdown dropdown-end opacity-0 group-hover:opacity-100">
        <button tabIndex={0} className="btn btn-ghost btn-xs btn-circle" aria-label="Chat actions">
          <MoreHorizontal size={15} />
        </button>
        <ul
          tabIndex={0}
          className="dropdown-content menu z-30 w-44 rounded-box border border-[var(--border)] bg-[var(--bg-elevated)] p-1 shadow-lg"
        >
          <li>
            <button onClick={() => patch({ pinned: !chat.pinned })}>{chat.pinned ? 'Unpin' : 'Pin'}</button>
          </li>
          <li>
            <button onClick={() => setRenaming(true)}>Rename</button>
          </li>
          <li>
            <button onClick={() => patch({ archived: !chat.archived })}>
              {chat.archived ? 'Unarchive' : 'Archive'}
            </button>
          </li>
          <li>
            <a href={`/api/chats/${chat.id}/export?format=jsonl`} download>
              Export JSONL
            </a>
          </li>
          <li>
            <button className="text-[var(--destructive)]" onClick={remove}>
              Delete
            </button>
          </li>
        </ul>
      </div>
    </li>
  );
}
