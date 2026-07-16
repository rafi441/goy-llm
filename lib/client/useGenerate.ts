'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStream, type StreamKind } from '../store/stream';
import { useUi } from '../store/ui';
import { qk } from './hooks';
import type { PlayMode } from '../types';

async function drive(
  url: string,
  body: unknown,
  controller: AbortController,
  onDelta: (d: string) => void,
): Promise<{ aborted: boolean; error: string | null; messageId?: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  if (!res.body) return { aborted: false, error: 'No response stream' };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let error: string | null = null;
  let messageId: string | undefined;
  let aborted = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const line = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        try {
          const payload = JSON.parse(line.slice(5).trim()) as {
            delta?: string;
            done?: boolean;
            aborted?: boolean;
            error?: string;
            messageId?: string;
          };
          if (payload.delta) onDelta(payload.delta);
          if (payload.error) error = payload.error;
          if (payload.messageId) messageId = payload.messageId;
          if (payload.aborted) aborted = true;
        } catch {
          /* ignore malformed frame */
        }
      }
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') aborted = true;
    else error = e instanceof Error ? e.message : 'Stream failed';
  }
  return { aborted, error, messageId };
}

export function useGenerate() {
  const qc = useQueryClient();
  const stream = useStream();
  const pushToast = useUi((s) => s.pushToast);

  const run = useCallback(
    async (
      url: string,
      body: unknown,
      chatId: string,
      kind: StreamKind,
      targetMessageId: string | null,
      seed = '',
    ) => {
      if (useStream.getState().running) return;
      const controller = new AbortController();
      useStream.getState().begin(chatId, kind, targetMessageId, controller, seed);

      const result = await drive(url, body, controller, (d) => useStream.getState().append(d));
      const text = useStream.getState().text;

      if (result.error) {
        pushToast(result.error, 'error');
        useStream.getState().fail(result.error);
      }
      useStream.getState().finish();
      qc.invalidateQueries({ queryKey: qk.messages(chatId) });
      qc.invalidateQueries({ queryKey: qk.chat(chatId) });
      qc.invalidateQueries({ queryKey: qk.chats });
      return { ...result, text };
    },
    [qc, pushToast],
  );

  const send = useCallback(
    (chatId: string, content: string, mode: PlayMode, directive?: { content: string; strong?: boolean } | null) =>
      run('/api/chat', { chatId, content, mode, directive: directive ?? null }, chatId, 'new', null),
    [run],
  );

  const generateScene = useCallback(
    (
      chatId: string,
      genMode: PlayMode,
      directive?: { content: string; strong?: boolean } | null,
    ) => run('/api/chat', { chatId, genMode, directive: directive ?? null }, chatId, 'new', null),
    [run],
  );

  const impersonate = useCallback(
    (chatId: string, input?: string) =>
      run('/api/chat', { chatId, genMode: 'as_user', impersonateInput: input }, chatId, 'impersonate', null),
    [run],
  );

  const regenerate = useCallback(
    (chatId: string, messageId: string) =>
      run('/api/chat/regenerate', { chatId, messageId }, chatId, 'regen', messageId),
    [run],
  );

  const continueMessage = useCallback(
    (chatId: string, messageId: string, seed: string) =>
      run('/api/chat/continue', { chatId, messageId }, chatId, 'continue', messageId, seed),
    [run],
  );

  const stop = useCallback(() => useStream.getState().abort(), []);

  return { send, generateScene, impersonate, regenerate, continueMessage, stop, stream };
}
