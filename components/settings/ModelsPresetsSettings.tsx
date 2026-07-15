'use client';

import { useState } from 'react';
import { Plus, Trash2, Star, EyeOff, Eye, RefreshCw, Check } from 'lucide-react';
import { usePresets, useConnections, useConnectionModels, useInvalidate, qk, api } from '@/lib/client/hooks';
import { Slider } from '@/components/ui/Slider';
import type { GenConfig, Preset } from '@/lib/types';

const SEED_PRESETS: { name: string; config: GenConfig }[] = [
  { name: 'Creative', config: { temperature: 1.1, top_p: 1, top_k: 0, max_tokens: 512 } },
  { name: 'Balanced', config: { temperature: 0.9, top_p: 0.95, max_tokens: 512 } },
  { name: 'Precise', config: { temperature: 0.6, top_p: 0.9, max_tokens: 512 } },
];

export function ModelsPresetsSettings() {
  const { data: presets = [] } = usePresets();
  const invalidate = useInvalidate();
  const [editingId, setEditingId] = useState<string | null>(null);

  const create = async (name: string, config: GenConfig, isDefault = false) => {
    await api.apiSend('/api/presets', 'POST', { name, config, is_default: isDefault });
    invalidate([qk.presets]);
  };

  const seed = async () => {
    for (const [i, p] of SEED_PRESETS.entries()) await create(p.name, p.config, i === 1 && presets.length === 0);
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--fg)]">Presets</h3>
          <div className="flex gap-1">
            {presets.length === 0 && (
              <button className="btn btn-ghost btn-sm" onClick={seed}>
                Add defaults
              </button>
            )}
            <button className="btn btn-primary btn-sm gap-1" onClick={() => create('New preset', { temperature: 0.9 })}>
              <Plus size={14} /> New
            </button>
          </div>
        </div>
        <ul className="flex flex-col gap-2">
          {presets.map((p) => (
            <PresetRow
              key={p.id}
              preset={p}
              editing={editingId === p.id}
              onToggleEdit={() => setEditingId(editingId === p.id ? null : p.id)}
            />
          ))}
        </ul>
      </section>

      <ModelPrefsSection />
    </div>
  );
}

const PRESET_PARAMS = [
  { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.01, def: 0.9 },
  { key: 'top_p', label: 'Top P', min: 0, max: 1, step: 0.01, def: 1 },
  { key: 'top_k', label: 'Top K', min: 0, max: 200, step: 1, def: 0 },
  { key: 'max_tokens', label: 'Max tokens', min: 16, max: 8192, step: 16, def: 512 },
] as const;

function PresetRow({
  preset,
  editing,
  onToggleEdit,
}: {
  preset: Preset;
  editing: boolean;
  onToggleEdit: () => void;
}) {
  const invalidate = useInvalidate();
  const [name, setName] = useState(preset.name);

  const patch = (body: Record<string, unknown>) =>
    api.apiSend(`/api/presets/${preset.id}`, 'PATCH', body).then(() => invalidate([qk.presets]));

  const setParam = (key: keyof GenConfig, value: number) =>
    patch({ config: { ...preset.config, [key]: value } as GenConfig });

  return (
    <li className="rounded-lg border border-[var(--border)] px-3 py-2">
      <div className="flex items-center gap-2">
        <input
          className="input input-xs flex-1 border-[var(--border)] bg-[var(--bg)]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== preset.name && patch({ name })}
        />
        <button
          className={`btn btn-ghost btn-xs gap-1 ${preset.is_default ? 'text-[var(--primary)]' : ''}`}
          onClick={() => patch({ is_default: true })}
        >
          {preset.is_default && <Check size={12} />} Default
        </button>
        <button className="btn btn-ghost btn-xs" onClick={onToggleEdit}>
          {editing ? 'Done' : 'Edit'}
        </button>
        <button
          className="btn btn-ghost btn-xs btn-circle text-[var(--destructive)]"
          onClick={() => api.apiSend(`/api/presets/${preset.id}`, 'DELETE').then(() => invalidate([qk.presets]))}
          aria-label="Delete preset"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {editing && (
        <div className="mt-3 flex flex-col gap-3">
          {PRESET_PARAMS.map((p) => (
            <Slider
              key={p.key}
              label={p.label}
              value={preset.config[p.key] as number | undefined}
              defaultValue={p.def}
              min={p.min}
              max={p.max}
              step={p.step}
              onChange={(v) => setParam(p.key, v)}
              onReset={() => setParam(p.key, p.def)}
            />
          ))}
        </div>
      )}
    </li>
  );
}

function ModelPrefsSection() {
  const { data: connections = [] } = useConnections();
  const [connId, setConnId] = useState<string | null>(null);
  const active = connId ?? connections[0]?.id ?? null;
  const { data, refetch, isFetching } = useConnectionModels(active);
  const invalidate = useInvalidate();

  const setPref = async (modelId: string, patch: Record<string, unknown>) => {
    if (!active) return;
    await api.apiSend(`/api/connections/${active}/model-prefs`, 'POST', { model_id: modelId, ...patch });
    invalidate([qk.models, qk.connectionModels(active)]);
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--fg)]">Model preferences</h3>
        <button className="btn btn-ghost btn-sm gap-1" onClick={() => refetch()}>
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      <select
        className="select select-sm mb-3 w-full border-[var(--border)] bg-[var(--bg)]"
        value={active ?? ''}
        onChange={(e) => setConnId(e.target.value)}
      >
        {connections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {data?.error && <p className="mb-2 text-xs text-[var(--destructive)]">{data.error}</p>}
      <ul className="scrollbar-thin flex max-h-72 flex-col gap-1 overflow-y-auto">
        {(data?.models ?? []).map((m) => (
          <li key={m.model_id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5">
            <button
              className={m.favorite ? 'text-[var(--color-warning)]' : 'text-[var(--fg-subtle)]'}
              onClick={() => setPref(m.model_id, { favorite: !m.favorite })}
              aria-label="Favorite"
            >
              <Star size={14} fill={m.favorite ? 'currentColor' : 'none'} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-[var(--fg)]">{m.display_name}</div>
              <input
                className="input input-xs mt-0.5 w-full border-[var(--border)] bg-[var(--bg)]"
                placeholder="Alias / nickname"
                defaultValue={m.alias ?? ''}
                onBlur={(e) => e.target.value !== (m.alias ?? '') && setPref(m.model_id, { alias: e.target.value || null })}
              />
            </div>
            <button
              className="btn btn-ghost btn-xs btn-circle"
              onClick={() => setPref(m.model_id, { hidden: !m.hidden })}
              aria-label={m.hidden ? 'Unhide' : 'Hide'}
            >
              {m.hidden ? <EyeOff size={14} className="text-[var(--fg-subtle)]" /> : <Eye size={14} />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
