'use client';

import { useMemo } from 'react';
import { useChat, useConnectionModels, usePresets, useInvalidate, qk, api } from '@/lib/client/hooks';
import { Slider } from '@/components/ui/Slider';
import { useUi } from '@/lib/store/ui';
import type { Capabilities, GenConfig } from '@/lib/types';

type NumericKey =
  | 'temperature'
  | 'top_p'
  | 'top_k'
  | 'min_p'
  | 'frequency_penalty'
  | 'presence_penalty'
  | 'repetition_penalty'
  | 'max_tokens';

interface ParamSpec {
  key: NumericKey;
  label: string;
  tooltip: string;
  min: number;
  max: number;
  step: number;
  def: number;
}

const PARAMS: ParamSpec[] = [
  { key: 'temperature', label: 'Temperature', tooltip: 'Randomness. Higher = more creative.', min: 0, max: 2, step: 0.01, def: 0.9 },
  { key: 'top_p', label: 'Top P', tooltip: 'Nucleus sampling cutoff.', min: 0, max: 1, step: 0.01, def: 1 },
  { key: 'top_k', label: 'Top K', tooltip: 'Limit to K most likely tokens.', min: 0, max: 200, step: 1, def: 40 },
  { key: 'min_p', label: 'Min P', tooltip: 'Minimum probability relative to the top token.', min: 0, max: 1, step: 0.01, def: 0 },
  { key: 'frequency_penalty', label: 'Frequency penalty', tooltip: 'Penalize repeated tokens.', min: -2, max: 2, step: 0.01, def: 0 },
  { key: 'presence_penalty', label: 'Presence penalty', tooltip: 'Penalize tokens already present.', min: -2, max: 2, step: 0.01, def: 0 },
  { key: 'repetition_penalty', label: 'Repetition penalty', tooltip: 'Discourage verbatim repetition.', min: 0, max: 2, step: 0.01, def: 1 },
  { key: 'max_tokens', label: 'Max tokens', tooltip: 'Reserved space for the reply.', min: 16, max: 8192, step: 16, def: 512 },
];

export function ModelConfigTab({ chatId }: { chatId: string }) {
  const { data } = useChat(chatId);
  const { data: presets = [] } = usePresets();
  const invalidate = useInvalidate();
  const pushToast = useUi((s) => s.pushToast);
  const chat = data?.chat;
  const modelsQuery = useConnectionModels(chat?.connection_id ?? null);
  const capabilities = modelsQuery.data?.capabilities as Capabilities | undefined;

  const config = useMemo<GenConfig>(() => chat?.gen_config ?? {}, [chat]);

  const supports = (key: keyof GenConfig): boolean => {
    if (!capabilities) return true;
    return capabilities.supports[key];
  };

  const update = (patch: GenConfig) => {
    const merged = { ...config, ...patch };
    api.apiSend(`/api/chats/${chatId}`, 'PATCH', { gen_config: merged }).then(() => invalidate([qk.chat(chatId)]));
  };

  const applyPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (preset) update(preset.config);
  };

  const saveAsPreset = async () => {
    const name = window.prompt('Preset name');
    if (!name) return;
    await api.apiSend('/api/presets', 'POST', { name, config });
    invalidate([qk.presets]);
    pushToast('Preset saved', 'success');
  };

  if (!chat) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">Preset</label>
        <div className="flex gap-1">
          <select
            className="select select-sm flex-1 border-[var(--border)] bg-[var(--bg)]"
            defaultValue=""
            onChange={(e) => e.target.value && applyPreset(e.target.value)}
          >
            <option value="" disabled>
              Apply a preset…
            </option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={saveAsPreset}>
            Save
          </button>
        </div>
      </div>

      {PARAMS.map((p) => {
        const enabled = supports(p.key);
        return (
          <Slider
            key={p.key}
            label={p.label + (enabled ? '' : ' (unsupported)')}
            tooltip={p.tooltip}
            value={config[p.key] as number | undefined}
            defaultValue={p.def}
            min={p.min}
            max={p.max}
            step={p.step}
            disabled={!enabled}
            onChange={(v) => update({ [p.key]: v } as GenConfig)}
            onReset={() => update({ [p.key]: p.def } as GenConfig)}
          />
        );
      })}

      <div className={supports('seed') ? '' : 'pointer-events-none opacity-40'}>
        <label className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">Seed</label>
        <input
          type="number"
          className="input input-sm w-full border-[var(--border)] bg-[var(--bg)]"
          placeholder="random"
          value={config.seed ?? ''}
          onChange={(e) => update({ seed: e.target.value ? Number(e.target.value) : null })}
        />
      </div>

      <StopSequences
        value={config.stop_sequences ?? []}
        disabled={!supports('stop_sequences')}
        onChange={(v) => update({ stop_sequences: v })}
      />
    </div>
  );
}

function StopSequences({
  value,
  disabled,
  onChange,
}: {
  value: string[];
  disabled: boolean;
  onChange: (v: string[]) => void;
}) {
  return (
    <div className={disabled ? 'pointer-events-none opacity-40' : ''}>
      <label className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">Stop sequences</label>
      <div className="mb-1 flex flex-wrap gap-1">
        {value.map((s, i) => (
          <span key={i} className="badge badge-sm gap-1 border-[var(--border)] bg-[var(--bg-hover)]">
            {JSON.stringify(s)}
            <button onClick={() => onChange(value.filter((_, idx) => idx !== i))}>×</button>
          </span>
        ))}
      </div>
      <input
        className="input input-sm w-full border-[var(--border)] bg-[var(--bg)]"
        placeholder="Type and press Enter"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
            onChange([...value, e.currentTarget.value]);
            e.currentTarget.value = '';
          }
        }}
      />
    </div>
  );
}
