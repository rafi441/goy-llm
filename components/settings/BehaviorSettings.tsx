'use client';

import { useEffect, useState } from 'react';
import { useBehavior, useModels, useInvalidate, qk, api } from '@/lib/client/hooks';
import type { BehaviorSettings as Behavior } from '@/lib/db/repos/settings';

export function BehaviorSettings() {
  const { data } = useBehavior();
  const { data: models = [] } = useModels();
  const invalidate = useInvalidate();
  const [local, setLocal] = useState<Behavior | null>(null);

  useEffect(() => {
    if (data && !local) setLocal(data);
  }, [data, local]);

  if (!local) return null;

  const save = (patch: Partial<Behavior>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    api.apiSend('/api/settings/behavior', 'PATCH', patch).then(() => invalidate([qk.behavior]));
  };

  const modelValue = (connId: string | null, modelId: string | null) =>
    connId && modelId ? `${connId}::${modelId}` : '';

  const parseModel = (v: string): [string | null, string | null] => {
    if (!v) return [null, null];
    const [c, m] = v.split('::');
    return [c ?? null, m ?? null];
  };

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-base font-semibold text-[var(--fg)]">Behavior</h3>

      <label className="block">
        <span className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">Global system prompt</span>
        <textarea
          className="textarea w-full border-[var(--border)] bg-[var(--bg)] text-sm"
          rows={4}
          value={local.system_prompt}
          onChange={(e) => setLocal({ ...local, system_prompt: e.target.value })}
          onBlur={(e) => save({ system_prompt: e.target.value })}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">Narrator name</span>
        <input
          className="input input-sm w-full border-[var(--border)] bg-[var(--bg)]"
          value={local.narrator_name}
          onChange={(e) => setLocal({ ...local, narrator_name: e.target.value })}
          onBlur={(e) => save({ narrator_name: e.target.value })}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">
          Utility model (titles & suggestions)
        </span>
        <select
          className="select select-sm w-full border-[var(--border)] bg-[var(--bg)]"
          value={modelValue(local.utility_connection_id, local.utility_model_id)}
          onChange={(e) => {
            const [c, m] = parseModel(e.target.value);
            save({ utility_connection_id: c, utility_model_id: m });
          }}
        >
          <option value="">Use the chat&apos;s model</option>
          {models.map((m) => (
            <option key={`${m.connection_id}:${m.model_id}`} value={`${m.connection_id}::${m.model_id}`}>
              {m.connection_name} · {m.display_name}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-lg border border-[var(--border)] p-3">
        <h4 className="mb-2 text-sm font-medium text-[var(--fg)]">RAG / Embeddings</h4>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">Embedding model</span>
          <select
            className="select select-sm w-full border-[var(--border)] bg-[var(--bg)]"
            value={modelValue(local.embedding_connection_id, local.embedding_model_id)}
            onChange={(e) => {
              const [c, m] = parseModel(e.target.value);
              save({ embedding_connection_id: c, embedding_model_id: m });
            }}
          >
            <option value="">Not configured</option>
            {models.map((m) => (
              <option key={`${m.connection_id}:${m.model_id}`} value={`${m.connection_id}::${m.model_id}`}>
                {m.connection_name} · {m.display_name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-[var(--fg-subtle)]">
            Local models like nomic-embed-text or bge-m3 via Ollama work well.
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">Top K</span>
            <input
              type="number"
              min={1}
              max={20}
              className="input input-sm w-full border-[var(--border)] bg-[var(--bg)]"
              value={local.rag_top_k}
              onChange={(e) => save({ rag_top_k: Number(e.target.value) })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">Similarity threshold</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="input input-sm w-full border-[var(--border)] bg-[var(--bg)]"
              value={local.rag_threshold}
              onChange={(e) => save({ rag_threshold: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
