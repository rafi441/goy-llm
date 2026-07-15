'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useLorebooks, useLorebook, useInvalidate, qk, api } from '@/lib/client/hooks';
import type { LorebookEntry } from '@/lib/types';

export function LorebookModal({
  open,
  onClose,
  characterId,
}: {
  open: boolean;
  onClose: () => void;
  characterId: string | null;
}) {
  const { data: lorebooks = [] } = useLorebooks();
  const invalidate = useInvalidate();

  const relevant = useMemo(
    () => lorebooks.filter((l) => l.scope === 'global' || l.character_id === characterId),
    [lorebooks, characterId],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? relevant[0]?.id ?? null;

  const createBook = async (scope: 'global' | 'character') => {
    const name = scope === 'character' ? 'Character Lorebook' : 'Global Lorebook';
    const res = await api.apiSend<{ lorebook: { id: string } }>('/api/lorebooks', 'POST', {
      name,
      scope,
      character_id: scope === 'character' ? characterId : null,
    });
    invalidate([qk.lorebooks]);
    setSelectedId(res.lorebook.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="Lorebook — World Info" size="lg">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {relevant.map((l) => (
          <button
            key={l.id}
            className={`btn btn-xs ${activeId === l.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSelectedId(l.id)}
          >
            {l.name} <span className="opacity-60">({l.scope})</span>
          </button>
        ))}
        {characterId && (
          <button className="btn btn-ghost btn-xs gap-1" onClick={() => createBook('character')}>
            <Plus size={12} /> Character book
          </button>
        )}
        <button className="btn btn-ghost btn-xs gap-1" onClick={() => createBook('global')}>
          <Plus size={12} /> Global book
        </button>
      </div>

      {activeId ? (
        <LorebookEntries lorebookId={activeId} />
      ) : (
        <p className="py-8 text-center text-sm text-[var(--fg-subtle)]">
          No lorebook yet. Create one above.
        </p>
      )}
    </Modal>
  );
}

function LorebookEntries({ lorebookId }: { lorebookId: string }) {
  const { data } = useLorebook(lorebookId);
  const invalidate = useInvalidate();
  const entries = data?.entries ?? [];

  const refresh = () => invalidate([qk.lorebook(lorebookId)]);

  const addEntry = async () => {
    await api.apiSend(`/api/lorebooks/${lorebookId}`, 'POST', { keys: [], content: '' });
    refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <button className="btn btn-ghost btn-sm w-fit gap-1" onClick={addEntry}>
        <Plus size={14} /> Add entry
      </button>
      {entries.map((e) => (
        <EntryRow key={e.id} entry={e} onChanged={refresh} />
      ))}
      {entries.length === 0 && (
        <p className="py-4 text-center text-sm text-[var(--fg-subtle)]">No entries.</p>
      )}
    </div>
  );
}

function EntryRow({ entry, onChanged }: { entry: LorebookEntry; onChanged: () => void }) {
  const [keys, setKeys] = useState(entry.keys.join(', '));
  const [secondary, setSecondary] = useState(entry.secondary_keys.join(', '));
  const [content, setContent] = useState(entry.content);

  const save = (patch: Record<string, unknown>) =>
    api.apiSend(`/api/lorebook-entries/${entry.id}`, 'PATCH', patch).then(onChanged);

  const remove = () => api.apiSend(`/api/lorebook-entries/${entry.id}`, 'DELETE').then(onChanged);

  const parseKeys = (s: string) => s.split(',').map((k) => k.trim()).filter(Boolean);

  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-xs"
          checked={entry.enabled === 1}
          onChange={(e) => save({ enabled: e.target.checked ? 1 : 0 })}
        />
        <input
          className="input input-xs flex-1 border-[var(--border)] bg-[var(--bg)]"
          placeholder="Keys (comma separated)"
          value={keys}
          onChange={(e) => setKeys(e.target.value)}
          onBlur={() => save({ keys: parseKeys(keys) })}
        />
        <button
          className="btn btn-ghost btn-xs btn-circle text-[var(--destructive)]"
          onClick={remove}
          aria-label="Delete entry"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <textarea
        className="textarea textarea-sm mb-2 w-full border-[var(--border)] bg-[var(--bg)]"
        placeholder="Content injected when a key matches"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => save({ content })}
      />
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            className="checkbox checkbox-xs"
            checked={entry.constant === 1}
            onChange={(e) => save({ constant: e.target.checked ? 1 : 0 })}
          />
          Constant
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            className="checkbox checkbox-xs"
            checked={entry.selective === 1}
            onChange={(e) => save({ selective: e.target.checked ? 1 : 0 })}
          />
          Selective
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            className="checkbox checkbox-xs"
            checked={entry.case_sensitive === 1}
            onChange={(e) => save({ case_sensitive: e.target.checked ? 1 : 0 })}
          />
          Case
        </label>
        <label className="flex items-center gap-1">
          Order
          <input
            type="number"
            className="input input-xs w-14 border-[var(--border)] bg-[var(--bg)]"
            defaultValue={entry.insertion_order}
            onBlur={(e) => save({ insertion_order: Number(e.target.value) })}
          />
        </label>
      </div>
      {entry.selective === 1 && (
        <input
          className="input input-xs mt-2 w-full border-[var(--border)] bg-[var(--bg)]"
          placeholder="Secondary keys (all required)"
          value={secondary}
          onChange={(e) => setSecondary(e.target.value)}
          onBlur={() => save({ secondary_keys: parseKeys(secondary) })}
        />
      )}
    </div>
  );
}
