'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Eye } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { AvatarUpload } from '@/components/ui/AvatarUpload';
import { LorebookModal } from '@/components/lorebook/LorebookModal';
import { useCharacter, useInvalidate, qk, api } from '@/lib/client/hooks';
import { useUi } from '@/lib/store/ui';
import { estimateTokens } from '@/lib/tokenizer';
import type { Character } from '@/lib/types';

type Draft = Omit<Character, 'id' | 'created_at' | 'updated_at' | 'character_book'>;

const EMPTY: Draft = {
  name: '',
  avatar_path: null,
  spec: 'chara_card_v3',
  description: '',
  personality: '',
  scenario: '',
  first_mes: '',
  mes_example: '',
  creator_notes: '',
  system_prompt: '',
  post_history_instructions: '',
  alternate_greetings: [],
  tags: [],
  creator: '',
  character_version: '',
  extensions: {},
};

const TABS = ['Identity', 'Persona', 'Dialogue', 'Advanced', 'Lorebook'] as const;
type Tab = (typeof TABS)[number];

export function CharacterEditor() {
  const editorId = useUi((s) => s.characterEditorId);
  const close = useUi((s) => s.closeCharacterEditor);
  const pushToast = useUi((s) => s.pushToast);
  const invalidate = useInvalidate();
  const open = editorId !== null;
  const isNew = editorId === 'new';
  const { data: existing } = useCharacter(isNew ? null : editorId);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [tab, setTab] = useState<Tab>('Identity');
  const [hydrated, setHydrated] = useState(false);
  const [lorebookOpen, setLorebookOpen] = useState(false);
  const [preview, setPreview] = useState(false);

  // v2: old `char-draft-*` keys are ignored so any stale/empty drafts poisoned
  // by the pre-hydration autosave race can no longer overwrite real data.
  const storageKey = `char-draft-v2-${editorId ?? 'new'}`;

  // Re-hydrate whenever the target changes or the modal (re)opens.
  useEffect(() => {
    setHydrated(false);
    setTab('Identity');
  }, [editorId, open]);

  useEffect(() => {
    if (!open || hydrated) return;
    // Edit mode: wait for the character to load before hydrating, otherwise we'd
    // snapshot an EMPTY draft and the autosave below would persist it as "real".
    if (!isNew && !existing) return;

    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
    if (saved) {
      try {
        setDraft({ ...EMPTY, ...(JSON.parse(saved) as Draft) });
        setHydrated(true);
        return;
      } catch {
        /* ignore */
      }
    }
    if (existing) {
      const { id, created_at, updated_at, character_book, ...rest } = existing;
      void id;
      void created_at;
      void updated_at;
      void character_book;
      setDraft({ ...EMPTY, ...rest });
    } else {
      setDraft(EMPTY);
    }
    setHydrated(true);
  }, [open, hydrated, existing, isNew, storageKey]);

  useEffect(() => {
    if (!open || !hydrated) return;
    const t = setTimeout(() => window.localStorage.setItem(storageKey, JSON.stringify(draft)), 400);
    return () => clearTimeout(t);
  }, [draft, open, hydrated, storageKey]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const permanentTokens = useMemo(
    () =>
      estimateTokens(
        [draft.description, draft.personality, draft.scenario, draft.system_prompt, draft.post_history_instructions].join(
          '\n',
        ),
      ),
    [draft],
  );

  const save = async () => {
    if (!draft.name.trim()) {
      pushToast('Name is required', 'error');
      return;
    }
    if (isNew) {
      await api.apiSend('/api/characters', 'POST', draft);
    } else {
      await api.apiSend(`/api/characters/${editorId}`, 'PATCH', draft);
    }
    window.localStorage.removeItem(storageKey);
    invalidate([qk.characters, ...(isNew ? [] : [qk.character(editorId as string)])]);
    pushToast('Character saved', 'success');
    close();
  };

  const duplicate = async () => {
    if (isNew) return;
    await api.apiSend(`/api/characters/${editorId}/duplicate`, 'POST');
    invalidate([qk.characters]);
    pushToast('Duplicated', 'success');
  };

  return (
    <>
      <Modal
        open={open}
        onClose={close}
        title={isNew ? 'New character' : `Edit — ${draft.name || 'character'}`}
        size="lg"
        footer={
          <>
            <span className="mr-auto text-xs text-[var(--fg-subtle)]">
              Permanent prompt: {permanentTokens} tokens
              {permanentTokens > 4096 && <span className="ml-1 text-[var(--color-warning)]">(large)</span>}
            </span>
            {!isNew && (
              <>
                <button className="btn btn-ghost btn-sm gap-1" onClick={duplicate}>
                  <Copy size={14} /> Duplicate
                </button>
                <a className="btn btn-ghost btn-sm" href={`/api/characters/${editorId}/export?format=png`} download>
                  Export PNG
                </a>
              </>
            )}
            <button className="btn btn-ghost btn-sm gap-1" onClick={() => setPreview(true)}>
              <Eye size={14} /> Preview
            </button>
            <button className="btn btn-primary btn-sm" onClick={save}>
              Save
            </button>
          </>
        }
      >
        <div role="tablist" className="mb-4 flex gap-1 border-b border-[var(--border)]">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`px-3 py-2 text-sm ${
                tab === t
                  ? 'border-b-2 border-[var(--primary)] text-[var(--fg)]'
                  : 'text-[var(--fg-muted)]'
              }`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Identity' && (
          <div className="flex flex-col gap-4">
            <AvatarUpload value={draft.avatar_path} name={draft.name || '?'} onChange={(p) => set('avatar_path', p)} />
            <Field label="Name" value={draft.name} onChange={(v) => set('name', v)} />
            <TagInput label="Tags" tags={draft.tags} onChange={(t) => set('tags', t)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Creator" value={draft.creator} onChange={(v) => set('creator', v)} />
              <Field label="Version" value={draft.character_version} onChange={(v) => set('character_version', v)} />
            </div>
          </div>
        )}

        {tab === 'Persona' && (
          <div className="flex flex-col gap-4">
            <Area label="Description" value={draft.description} onChange={(v) => set('description', v)} rows={6} />
            <Area label="Personality" value={draft.personality} onChange={(v) => set('personality', v)} />
            <Area label="Scenario" value={draft.scenario} onChange={(v) => set('scenario', v)} />
          </div>
        )}

        {tab === 'Dialogue' && (
          <div className="flex flex-col gap-4">
            <Area label="First message" value={draft.first_mes} onChange={(v) => set('first_mes', v)} rows={5} />
            <GreetingsInput
              greetings={draft.alternate_greetings}
              onChange={(g) => set('alternate_greetings', g)}
            />
            <Area label="Example messages" value={draft.mes_example} onChange={(v) => set('mes_example', v)} rows={6} />
          </div>
        )}

        {tab === 'Advanced' && (
          <div className="flex flex-col gap-4">
            <Area label="System prompt (override)" value={draft.system_prompt} onChange={(v) => set('system_prompt', v)} />
            <Area
              label="Post-history instructions"
              value={draft.post_history_instructions}
              onChange={(v) => set('post_history_instructions', v)}
            />
            <Area label="Creator notes" value={draft.creator_notes} onChange={(v) => set('creator_notes', v)} />
          </div>
        )}

        {tab === 'Lorebook' && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-[var(--fg-muted)]">
              World Info entries triggered by keywords in recent messages.
            </p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setLorebookOpen(true)}
              disabled={isNew}
              title={isNew ? 'Save the character first' : undefined}
            >
              Edit lorebook
            </button>
            {isNew && <span className="text-xs text-[var(--fg-subtle)]">Save first to attach a lorebook.</span>}
          </div>
        )}
      </Modal>

      {!isNew && (
        <LorebookModal open={lorebookOpen} onClose={() => setLorebookOpen(false)} characterId={editorId as string} />
      )}

      <Modal open={preview} onClose={() => setPreview(false)} title="Prompt preview" size="md">
        <pre className="scrollbar-thin max-h-[60dvh] overflow-auto whitespace-pre-wrap text-xs text-[var(--fg-muted)]">
          {buildPreview(draft)}
        </pre>
      </Modal>
    </>
  );
}

function buildPreview(d: Draft): string {
  const parts: string[] = [];
  if (d.system_prompt) parts.push(`[system]\n${d.system_prompt}`);
  if (d.description) parts.push(`${d.name}'s description:\n${d.description}`);
  if (d.personality) parts.push(`${d.name}'s personality: ${d.personality}`);
  if (d.scenario) parts.push(`Scenario: ${d.scenario}`);
  if (d.mes_example) parts.push(`Example dialogue:\n${d.mes_example}`);
  if (d.first_mes) parts.push(`[assistant]\n${d.first_mes}`);
  if (d.post_history_instructions) parts.push(`[post-history]\n${d.post_history_instructions}`);
  return parts.join('\n\n');
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">{label}</span>
      <input
        className="input input-sm w-full border-[var(--border)] bg-[var(--bg)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs uppercase text-[var(--fg-subtle)]">
        {label}
        <span className="normal-case tabular-nums">{estimateTokens(value)}t</span>
      </span>
      <textarea
        className="textarea w-full border-[var(--border)] bg-[var(--bg)] text-sm"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TagInput({ label, tags, onChange }: { label: string; tags: string[]; onChange: (t: string[]) => void }) {
  return (
    <div>
      <span className="mb-1 block text-xs uppercase text-[var(--fg-subtle)]">{label}</span>
      <div className="mb-1 flex flex-wrap gap-1">
        {tags.map((t, i) => (
          <span key={i} className="badge badge-sm gap-1 border-[var(--border)] bg-[var(--bg-hover)]">
            {t}
            <button onClick={() => onChange(tags.filter((_, idx) => idx !== i))}>×</button>
          </span>
        ))}
      </div>
      <input
        className="input input-sm w-full border-[var(--border)] bg-[var(--bg)]"
        placeholder="Add tag, press Enter"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
            e.preventDefault();
            onChange([...tags, e.currentTarget.value.trim()]);
            e.currentTarget.value = '';
          }
        }}
      />
    </div>
  );
}

function GreetingsInput({ greetings, onChange }: { greetings: string[]; onChange: (g: string[]) => void }) {
  return (
    <div>
      <span className="mb-1 flex items-center justify-between text-xs uppercase text-[var(--fg-subtle)]">
        Alternate greetings
        <button className="btn btn-ghost btn-xs" onClick={() => onChange([...greetings, ''])}>
          + Add
        </button>
      </span>
      <div className="flex flex-col gap-2">
        {greetings.map((g, i) => (
          <div key={i} className="flex gap-1">
            <textarea
              className="textarea textarea-sm flex-1 border-[var(--border)] bg-[var(--bg)]"
              rows={2}
              value={g}
              onChange={(e) => onChange(greetings.map((x, idx) => (idx === i ? e.target.value : x)))}
            />
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => onChange(greetings.filter((_, idx) => idx !== i))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
