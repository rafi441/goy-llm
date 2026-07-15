'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, Star, RefreshCw, Search } from 'lucide-react';
import { useModels, useInvalidate, qk } from '@/lib/client/hooks';
import { api } from '@/lib/client/hooks';
import { useUi } from '@/lib/store/ui';
import type { PickerModel } from '@/lib/types';

interface ModelPickerProps {
  connectionId: string | null;
  modelId: string | null;
  onSelect: (connectionId: string, modelId: string) => void;
}

export function ModelPicker({ connectionId, modelId, onSelect }: ModelPickerProps) {
  const { data: models = [], refetch, isFetching } = useModels();
  const invalidate = useInvalidate();
  const openSettings = useUi((s) => s.openSettings);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const current = models.find((m) => m.connection_id === connectionId && m.model_id === modelId);
  const label = current ? current.alias ?? current.display_name : modelId ?? 'Select model';

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return models
      .filter((m) => !m.hidden)
      .filter(
        (m) =>
          !q ||
          m.display_name.toLowerCase().includes(q) ||
          m.model_id.toLowerCase().includes(q) ||
          (m.alias ?? '').toLowerCase().includes(q) ||
          m.connection_name.toLowerCase().includes(q),
      );
  }, [models, query]);

  const groups = useMemo(() => {
    const byConn = new Map<string, PickerModel[]>();
    for (const m of visible) {
      const arr = byConn.get(m.connection_name) ?? [];
      arr.push(m);
      byConn.set(m.connection_name, arr);
    }
    return [...byConn.entries()];
  }, [visible]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggleFavorite = async (m: PickerModel) => {
    await api.apiSend(`/api/connections/${m.connection_id}/model-prefs`, 'POST', {
      model_id: m.model_id,
      favorite: !m.favorite,
    });
    invalidate([qk.models]);
  };

  const pick = (m: PickerModel) => {
    onSelect(m.connection_id, m.model_id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn btn-ghost btn-sm gap-1.5 text-[var(--fg)]"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[220px] truncate">{label}</span>
        <ChevronDown size={15} className="text-[var(--fg-subtle)]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-[340px] rounded-box border border-[var(--border)] bg-[var(--bg-elevated)] p-2 shadow-xl">
          <div className="mb-2 flex items-center gap-1">
            <label className="input input-sm flex flex-1 items-center gap-2 border-[var(--border)] bg-[var(--bg)]">
              <Search size={14} className="text-[var(--fg-subtle)]" />
              <input
                autoFocus
                className="grow"
                placeholder="Search models"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') setHighlight((h) => Math.min(h + 1, visible.length - 1));
                  if (e.key === 'ArrowUp') setHighlight((h) => Math.max(h - 1, 0));
                  if (e.key === 'Enter' && visible[highlight]) pick(visible[highlight]!);
                  if (e.key === 'Escape') setOpen(false);
                }}
              />
            </label>
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => refetch()}
              aria-label="Refresh models"
            >
              <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="scrollbar-thin max-h-80 overflow-y-auto">
            {visible.length === 0 && (
              <div className="p-3 text-center text-sm text-[var(--fg-subtle)]">
                No models.{' '}
                <button className="link text-[var(--primary)]" onClick={() => openSettings('connections')}>
                  Add a connection
                </button>
              </div>
            )}
            {groups.map(([conn, list]) => (
              <div key={conn} className="mb-1">
                <div className="px-2 py-1 text-xs font-medium uppercase text-[var(--fg-subtle)]">{conn}</div>
                {list.map((m) => {
                  const idx = visible.indexOf(m);
                  const selected = m.connection_id === connectionId && m.model_id === modelId;
                  return (
                    <div
                      key={`${m.connection_id}:${m.model_id}`}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 ${
                        idx === highlight ? 'bg-[var(--bg-hover)]' : ''
                      } ${selected ? 'ring-1 ring-[var(--ring)]' : ''}`}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => pick(m)}
                    >
                      <button
                        className="text-[var(--fg-subtle)] hover:text-[var(--color-warning)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(m);
                        }}
                        aria-label="Favorite"
                      >
                        <Star size={13} fill={m.favorite ? 'currentColor' : 'none'} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-[var(--fg)]">{m.alias ?? m.display_name}</div>
                        <div className="flex gap-1.5 text-[10px] text-[var(--fg-subtle)]">
                          {m.context_length && <span>{Math.round(m.context_length / 1000)}k ctx</span>}
                          {typeof m.metadata.prompt_price === 'number' && m.metadata.prompt_price > 0 && (
                            <span>${m.metadata.prompt_price.toFixed(2)}/1M</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
