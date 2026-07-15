'use client';

import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useChat, usePersonas, useInvalidate, qk, api } from '@/lib/client/hooks';
import { Avatar } from '@/components/ui/Avatar';
import { AvatarUpload } from '@/components/ui/AvatarUpload';

export function PersonaTab({ chatId }: { chatId: string }) {
  const { data } = useChat(chatId);
  const { data: personas = [] } = usePersonas();
  const invalidate = useInvalidate();
  const chat = data?.chat;
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);

  const setChatPersona = (personaId: string) =>
    api.apiSend(`/api/chats/${chatId}`, 'PATCH', { persona_id: personaId }).then(() =>
      invalidate([qk.chat(chatId)]),
    );

  const create = async () => {
    if (!name.trim()) return;
    const res = await api.apiSend<{ persona: { id: string } }>('/api/personas', 'POST', {
      name,
      description,
      avatar_path: avatar,
      is_default: personas.length === 0,
    });
    invalidate([qk.personas]);
    setChatPersona(res.persona.id);
    setCreating(false);
    setName('');
    setDescription('');
    setAvatar(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[var(--fg-subtle)]">
        The active persona speaks as you and fills the {'{{user}}'} macro.
      </p>
      <ul className="flex flex-col gap-1">
        {personas.map((p) => {
          const active = chat?.persona_id === p.id;
          return (
            <li key={p.id}>
              <button
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${
                  active ? 'bg-[var(--bg-hover)] ring-1 ring-[var(--ring)]' : 'hover:bg-[var(--bg-elevated)]'
                }`}
                onClick={() => setChatPersona(p.id)}
              >
                <Avatar path={p.avatar_path} name={p.name} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-[var(--fg)]">{p.name}</div>
                  <div className="truncate text-xs text-[var(--fg-subtle)]">{p.description}</div>
                </div>
                {active && <Check size={15} className="text-[var(--primary)]" />}
              </button>
            </li>
          );
        })}
      </ul>

      {creating ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3">
          <AvatarUpload value={avatar} name={name || 'P'} onChange={setAvatar} />
          <input
            className="input input-sm border-[var(--border)] bg-[var(--bg)]"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            className="textarea textarea-sm border-[var(--border)] bg-[var(--bg)]"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm flex-1" onClick={create}>
              Create
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost btn-sm justify-start gap-2" onClick={() => setCreating(true)}>
          <Plus size={15} /> New persona
        </button>
      )}
    </div>
  );
}
