'use client';

import { useRouter } from 'next/navigation';
import { Plus, Upload, MessageSquarePlus, Pencil } from 'lucide-react';
import { useCharacters, useModels, useInvalidate, qk, api } from '@/lib/client/hooks';
import { useUi } from '@/lib/store/ui';
import { Avatar } from '@/components/ui/Avatar';
import type { Character } from '@/lib/types';

export function NewChatLanding() {
  const router = useRouter();
  const { data: characters = [] } = useCharacters();
  const { data: models = [] } = useModels();
  const invalidate = useInvalidate();
  const openEditor = useUi((s) => s.openCharacterEditor);
  const setImportOpen = useUi((s) => s.setImportOpen);

  const defaultModel = models.find((m) => m.favorite) ?? models[0] ?? null;

  const startChat = async (character: Character | null) => {
    const res = await api.apiSend<{ chat: { id: string } }>('/api/chats', 'POST', {
      character_id: character?.id ?? null,
      title: character ? character.name : 'New Chat',
      connection_id: defaultModel?.connection_id ?? null,
      model_id: defaultModel?.model_id ?? null,
    });
    invalidate([qk.chats]);
    router.push(`/c/${res.chat.id}`);
  };

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[52rem] px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="mb-1 text-2xl font-semibold text-[var(--fg)]">Start a roleplay</h1>
          <p className="text-sm text-[var(--fg-muted)]">Pick a character, or start a blank scene.</p>
        </div>

        <div className="mb-6 flex flex-wrap justify-center gap-2">
          <button className="btn btn-sm gap-1.5 bg-[var(--bg-elevated)]" onClick={() => startChat(null)}>
            <MessageSquarePlus size={15} /> Blank chat
          </button>
          <button className="btn btn-sm gap-1.5 bg-[var(--bg-elevated)]" onClick={() => openEditor('new')}>
            <Plus size={15} /> New character
          </button>
          <button className="btn btn-sm gap-1.5 bg-[var(--bg-elevated)]" onClick={() => setImportOpen(true)}>
            <Upload size={15} /> Import card
          </button>
        </div>

        {characters.length === 0 ? (
          <div className="rounded-box border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--fg-subtle)]">
            No characters yet. Create one or import a SillyTavern card.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {characters.map((c) => (
              <div
                key={c.id}
                className="group relative flex flex-col items-center gap-2 rounded-box border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-center transition hover:border-[var(--primary)]"
              >
                <button
                  className="absolute right-1 top-1 btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100"
                  onClick={() => openEditor(c.id)}
                  aria-label="Edit character"
                >
                  <Pencil size={13} />
                </button>
                <button className="flex flex-col items-center gap-2" onClick={() => startChat(c)}>
                  <Avatar path={c.avatar_path} name={c.name} size={72} />
                  <span className="line-clamp-1 text-sm font-medium text-[var(--fg)]">{c.name}</span>
                  {c.tags.length > 0 && (
                    <span className="line-clamp-1 text-xs text-[var(--fg-subtle)]">
                      {c.tags.slice(0, 3).join(' · ')}
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
