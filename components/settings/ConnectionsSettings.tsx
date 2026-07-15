'use client';

import { useState } from 'react';
import { Plus, Trash2, Pencil, Wifi, Power } from 'lucide-react';
import { useConnections, useInvalidate, qk, api } from '@/lib/client/hooks';
import { useUi } from '@/lib/store/ui';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import type { MaskedConnection, OobMode, ProviderType } from '@/lib/types';

const TYPE_LABEL: Record<ProviderType, string> = {
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  openai_compat: 'OpenAI-compatible',
};

const DEFAULT_BASE: Record<ProviderType, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234/v1',
  openai_compat: 'https://api.example.com/v1',
};

export function ConnectionsSettings() {
  const { data: connections = [] } = useConnections();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<MaskedConnection | 'new' | null>(null);

  const remove = async (c: MaskedConnection) => {
    const check = await api.apiSend<{ requiresConfirm?: boolean; affectedChats: number }>(
      `/api/connections/${c.id}`,
      'DELETE',
    );
    const affected = check.affectedChats ?? 0;
    const ok = await confirmDialog({
      title: 'Delete connection',
      body:
        affected > 0
          ? `${affected} chat(s) use this connection. They will keep their history but their model becomes unavailable until you pick a replacement.`
          : 'Delete this connection?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await api.apiSend(`/api/connections/${c.id}?confirm=1`, 'DELETE');
    invalidate([qk.connections, qk.models]);
  };

  const toggle = async (c: MaskedConnection) => {
    await api.apiSend(`/api/connections/${c.id}`, 'PATCH', { enabled: c.enabled !== 1 });
    invalidate([qk.connections, qk.models]);
  };

  if (editing) {
    return (
      <ConnectionForm
        connection={editing === 'new' ? null : editing}
        onDone={() => {
          setEditing(null);
          invalidate([qk.connections, qk.models]);
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--fg)]">Connections</h3>
        <button className="btn btn-primary btn-sm gap-1" onClick={() => setEditing('new')}>
          <Plus size={14} /> Add
        </button>
      </div>

      {connections.length === 0 && (
        <p className="text-sm text-[var(--fg-subtle)]">
          No connections. Add OpenRouter, Ollama, LM Studio, or any OpenAI-compatible endpoint.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {connections.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-[var(--fg)]">{c.name}</span>
                <span className="badge badge-xs">{TYPE_LABEL[c.type]}</span>
                {c.enabled !== 1 && <span className="badge badge-xs badge-ghost">disabled</span>}
              </div>
              <div className="truncate text-xs text-[var(--fg-subtle)]">
                {c.base_url || DEFAULT_BASE[c.type]} {c.api_key_masked ? `· ${c.api_key_masked}` : ''}
              </div>
            </div>
            <TestButton id={c.id} />
            <button className="btn btn-ghost btn-xs btn-circle" onClick={() => toggle(c)} title="Enable/disable">
              <Power size={14} className={c.enabled === 1 ? 'text-success' : 'text-[var(--fg-subtle)]'} />
            </button>
            <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setEditing(c)} aria-label="Edit">
              <Pencil size={14} />
            </button>
            <button
              className="btn btn-ghost btn-xs btn-circle text-[var(--destructive)]"
              onClick={() => remove(c)}
              aria-label="Delete"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TestButton({ id }: { id: string }) {
  const [state, setState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [msg, setMsg] = useState('');
  const test = async () => {
    setState('testing');
    const res = await api.apiSend<{ ok: boolean; modelCount?: number; error?: string }>(
      `/api/connections/${id}/test`,
      'POST',
    );
    if (res.ok) {
      setState('ok');
      setMsg(`${res.modelCount} models`);
    } else {
      setState('fail');
      setMsg(res.error ?? 'failed');
    }
    setTimeout(() => setState('idle'), 4000);
  };
  return (
    <button
      className={`btn btn-ghost btn-xs gap-1 ${state === 'ok' ? 'text-success' : state === 'fail' ? 'text-[var(--destructive)]' : ''}`}
      onClick={test}
      title={msg}
    >
      <Wifi size={13} className={state === 'testing' ? 'animate-pulse' : ''} />
      {state === 'idle' || state === 'testing' ? 'Test' : msg}
    </button>
  );
}

function ConnectionForm({
  connection,
  onDone,
  onCancel,
}: {
  connection: MaskedConnection | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const pushToast = useUi((s) => s.pushToast);
  const [name, setName] = useState(connection?.name ?? '');
  const [type, setType] = useState<ProviderType>(connection?.type ?? 'openrouter');
  const [baseUrl, setBaseUrl] = useState(connection?.base_url ?? '');
  const [apiKey, setApiKey] = useState('');
  const [oobMode, setOobMode] = useState<OobMode>(connection?.oob_mode ?? 'system');

  const submit = async () => {
    if (!name.trim()) {
      pushToast('Name is required', 'error');
      return;
    }
    const body: Record<string, unknown> = { name, type, base_url: baseUrl || null, oob_mode: oobMode };
    if (apiKey) body.api_key = apiKey;
    try {
      if (connection) await api.apiSend(`/api/connections/${connection.id}`, 'PATCH', body);
      else await api.apiSend('/api/connections', 'POST', body);
      pushToast('Connection saved', 'success');
      onDone();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Save failed', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-semibold text-[var(--fg)]">
        {connection ? 'Edit connection' : 'New connection'}
      </h3>
      <label className="block">
        <span className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">Name</span>
        <input className="input input-sm w-full border-[var(--border)] bg-[var(--bg)]" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">Type</span>
        <select
          className="select select-sm w-full border-[var(--border)] bg-[var(--bg)]"
          value={type}
          onChange={(e) => setType(e.target.value as ProviderType)}
        >
          {(Object.keys(TYPE_LABEL) as ProviderType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">Base URL</span>
        <input
          className="input input-sm w-full border-[var(--border)] bg-[var(--bg)]"
          placeholder={DEFAULT_BASE[type]}
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">
          API key {connection?.has_key && <span className="normal-case">(leave blank to keep current)</span>}
        </span>
        <input
          type="password"
          className="input input-sm w-full border-[var(--border)] bg-[var(--bg)]"
          placeholder={connection?.api_key_masked ?? 'sk-…'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">OOC / Director mode</span>
        <select
          className="select select-sm w-full border-[var(--border)] bg-[var(--bg)]"
          value={oobMode}
          onChange={(e) => setOobMode(e.target.value as OobMode)}
        >
          <option value="system">System role (default)</option>
          <option value="user_prefix">User message with [OOC:] prefix</option>
        </select>
        <span className="mt-1 block text-xs text-[var(--fg-subtle)]">
          Use the user-prefix fallback for local instruct models that ignore a trailing system message.
        </span>
      </label>
      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" onClick={submit}>
          Save
        </button>
      </div>
    </div>
  );
}
