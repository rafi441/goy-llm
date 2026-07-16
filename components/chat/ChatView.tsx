'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat, useCharacter, usePersonas, useInvalidate, qk, api } from '@/lib/client/hooks';
import { useGenerate } from '@/lib/client/useGenerate';
import { useStream, streamStatus } from '@/lib/store/stream';
import { useUi } from '@/lib/store/ui';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { EmptyChat } from './EmptyChat';
import type { Message, PlayMode } from '@/lib/types';

export function ChatView({ chatId }: { chatId: string }) {
  const { data, isLoading } = useChat(chatId);
  const character = useCharacter(data?.chat.character_id ?? null);
  const personas = usePersonas();
  const invalidate = useInvalidate();
  const { send, generateScene, impersonate, regenerate, continueMessage, stop } = useGenerate();
  const stream = useStream();
  const pushToast = useUi((s) => s.pushToast);
  const playMode = useUi((s) => s.playMode);

  const [draft, setDraft] = useState('');
  const titledRef = useRef(false);

  const messages = data?.messages ?? [];
  const chat = data?.chat;
  const characterName = character.data?.name ?? 'Character';
  const userName =
    personas.data?.find((p) => p.id === chat?.persona_id)?.name ??
    personas.data?.find((p) => p.is_default)?.name ??
    'User';

  useEffect(() => {
    titledRef.current = false;
  }, [chatId]);

  useEffect(() => {
    if (
      !titledRef.current &&
      chat &&
      chat.title === 'New Chat' &&
      messages.filter((m) => m.type === 'chat').length >= 2 &&
      !stream.running
    ) {
      titledRef.current = true;
      api.apiSend(`/api/chats/${chatId}/auto-title`, 'POST').then(() => invalidate([qk.chats, qk.chat(chatId)]));
    }
  }, [chat, messages, stream.running, chatId, invalidate]);

  const onSubmit = useCallback(
    async (content: string, mode: PlayMode) => {
      if (!content.trim()) return;
      if (!chat?.model_id) {
        pushToast('Pick a model first (top-left).', 'error');
        return;
      }
      setDraft('');
      if (mode === 'as_user') {
        await api.apiSend(`/api/chats/${chatId}/messages`, 'POST', {
          role: 'user',
          type: 'chat',
          mode: 'as_user',
          content,
        });
        invalidate([qk.messages(chatId), qk.chat(chatId)]);
        await send(chatId, '', 'as_user');
      } else {
        const isNarration = mode === 'narrator';
        await api.apiSend(`/api/chats/${chatId}/messages`, 'POST', {
          role: 'assistant',
          type: isNarration ? 'narration' : 'chat',
          mode,
          content,
        });
        invalidate([qk.messages(chatId), qk.chat(chatId)]);
      }
    },
    [chat, chatId, send, invalidate, pushToast],
  );

  const onContinueScene = useCallback(
    (directive?: { content: string; strong?: boolean }) => {
      if (!chat?.model_id) {
        pushToast('Pick a model first (top-left).', 'error');
        return;
      }
      const genMode = playMode === 'as_user' ? 'as_char' : playMode;
      void generateScene(chatId, genMode, directive ?? null);
    },
    [chat, chatId, pushToast, generateScene, playMode],
  );

  const onImpersonate = useCallback(async () => {
    if (!chat?.model_id) {
      pushToast('Pick a model first (top-left).', 'error');
      return;
    }
    const r = await impersonate(chatId);
    if (r && !r.error && !r.aborted && r.text.trim()) setDraft(r.text.trim());
  }, [chat, chatId, pushToast, impersonate]);

  const onRegenerate = useCallback(
    (m: Message) => regenerate(chatId, m.id),
    [chatId, regenerate],
  );

  const onContinueMessage = useCallback(
    (m: Message) => continueMessage(chatId, m.id, m.swipes[m.swipe_index] ?? ''),
    [chatId, continueMessage],
  );

  const onSwipe = useCallback(
    async (m: Message, index: number) => {
      if (index >= m.swipes.length) {
        await regenerate(chatId, m.id);
        return;
      }
      await api.apiSend(`/api/messages/${m.id}`, 'PATCH', { swipe_index: index });
      invalidate([qk.messages(chatId), qk.chat(chatId)]);
    },
    [chatId, regenerate, invalidate],
  );

  const onEdit = useCallback(
    async (m: Message, text: string) => {
      const swipes = [...m.swipes];
      swipes[m.swipe_index] = text;
      await api.apiSend(`/api/messages/${m.id}`, 'PATCH', { swipes });
      invalidate([qk.messages(chatId), qk.chat(chatId)]);
    },
    [chatId, invalidate],
  );

  const onDelete = useCallback(
    async (m: Message, fromHere: boolean) => {
      if (fromHere) {
        const ok = await confirmDialog({
          title: 'Delete from here',
          body: 'Delete this message and everything below it?',
          confirmLabel: 'Delete',
          destructive: true,
        });
        if (!ok) return;
      }
      await api.apiSend(`/api/messages/${m.id}${fromHere ? '?from_here=1' : ''}`, 'DELETE');
      invalidate([qk.messages(chatId), qk.chat(chatId)]);
    },
    [chatId, invalidate],
  );

  const onBranch = useCallback(
    async (m: Message) => {
      const res = await api.apiSend<{ chat: { id: string } }>(`/api/chats/${chatId}/branch`, 'POST', {
        messageId: m.id,
      });
      invalidate([qk.chats]);
      pushToast('Branched to a new chat', 'success');
      window.location.href = `/c/${res.chat.id}`;
    },
    [chatId, invalidate, pushToast],
  );

  const onDirectiveToggle = useCallback(
    async (m: Message, pinned: boolean) => {
      await api.apiSend(`/api/messages/${m.id}`, 'PATCH', { pinned_directive: pinned });
      invalidate([qk.messages(chatId)]);
    },
    [chatId, invalidate],
  );

  if (isLoading || !chat) {
    return <div className="flex h-full items-center justify-center text-[var(--fg-subtle)]">Loading…</div>;
  }

  const hasVisible = messages.some((m) => m.type !== 'directive' || m.pinned_directive);

  return (
    <div className="flex h-full flex-col">
      {hasVisible ? (
        <MessageList
          chatId={chatId}
          messages={messages}
          characterName={characterName}
          userName={userName}
          avatarPath={character.data?.avatar_path ?? null}
          onRegenerate={onRegenerate}
          onContinue={onContinueMessage}
          onSwipe={onSwipe}
          onEdit={onEdit}
          onDelete={onDelete}
          onBranch={onBranch}
          onDirectiveToggle={onDirectiveToggle}
        />
      ) : (
        <EmptyChat
          characterName={character.data?.name ?? 'New scene'}
          userName={userName}
          avatarPath={character.data?.avatar_path ?? null}
          greetings={character.data?.alternate_greetings ?? []}
          onPick={(text) => setDraft(text)}
        />
      )}

      <Composer
        chatId={chatId}
        draft={draft}
        setDraft={setDraft}
        onSubmit={onSubmit}
        onGenerate={onContinueScene}
        onImpersonate={onImpersonate}
        running={stream.running && stream.chatId === chatId}
        status={stream.chatId === chatId ? streamStatus(stream.phase, stream.kind) : ''}
        onStop={stop}
      />
    </div>
  );
}
