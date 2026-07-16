'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUp, Square, Play, Plus, Wand2 } from 'lucide-react';
import { useChat, api } from '@/lib/client/hooks';
import { useUi } from '@/lib/store/ui';
import { estimateTokens } from '@/lib/tokenizer';
import { ModeChips } from './ModeChips';
import { DirectorPopover } from '@/components/director/DirectorPopover';
import { Suggestions } from '@/components/director/Suggestions';
import { TokenBar } from '@/components/ui/TokenBar';
import type { PlayMode } from '@/lib/types';

interface Props {
  chatId: string;
  draft: string;
  setDraft: (v: string) => void;
  onSubmit: (content: string, mode: PlayMode) => void;
  onGenerate: (directive?: { content: string; strong?: boolean }) => void;
  onImpersonate: () => void;
  running: boolean;
  status: string;
  onStop: () => void;
}

const PLACEHOLDERS: Record<PlayMode, string> = {
  as_user: 'Message…',
  as_char: 'Write as the character…',
  narrator: 'Narrate the scene…',
};

const MODE_BORDER: Record<PlayMode, string> = {
  as_user: 'border-[var(--border)]',
  as_char: 'border-[var(--primary)]/60',
  narrator: 'border-[var(--color-info)]/50',
};

export function Composer({ chatId, draft, setDraft, onSubmit, onGenerate, onImpersonate, running, status, onStop }: Props) {
  const mode = useUi((s) => s.playMode);
  const { data } = useChat(chatId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const msgCount = data?.messages.length ?? 0;
  const budgetQuery = useQuery({
    queryKey: ['budget', chatId, msgCount, running],
    enabled: !running && !!data?.chat.model_id,
    queryFn: () =>
      api.apiGet<{ totalTokens: number; budget: number }>(`/api/chats/${chatId}/prompt`),
  });

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 8 * 24 + 20)}px`;
  }, [draft]);

  const committed = budgetQuery.data?.totalTokens ?? 0;
  const budget = budgetQuery.data?.budget ?? 8192;
  const used = committed + estimateTokens(draft);

  const submit = () => {
    if (!draft.trim() || running) return;
    onSubmit(draft, mode);
  };

  return (
    <div className="shrink-0 px-2 pb-2 pt-1 sm:px-4 sm:pb-4">
      <div className="relative mx-auto max-w-[48rem]">
        <div
          className={`flex flex-col gap-1.5 rounded-3xl border bg-[var(--bg-elevated)] px-2.5 py-2 shadow-sm sm:rounded-[1.75rem] sm:px-3 sm:py-2.5 ${MODE_BORDER[mode]}`}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            className="min-h-6 w-full resize-none bg-transparent px-1 pt-1 text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
            placeholder={PLACEHOLDERS[mode]}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 rounded-full bg-[var(--bg)] p-0.5">
              <DirectorPopover chatId={chatId} onGenerate={onGenerate} />
              <Suggestions chatId={chatId} onPick={(t) => setDraft(t)} />
            </div>

            <ModeChips />

            <div className="ml-auto flex items-center gap-1.5">
              <TokenBar used={used} budget={budget} compact />
              {running ? (
                <div className="flex items-center gap-1.5">
                  {status && (
                    <span className="hidden animate-pulse text-xs text-[var(--fg-subtle)] sm:inline">
                      {status}…
                    </span>
                  )}
                  <button
                    className="btn btn-circle btn-sm bg-[var(--bg-hover)]"
                    onClick={onStop}
                    aria-label="Stop"
                    title="Stop generation"
                  >
                    <Square size={15} fill="currentColor" />
                  </button>
                </div>
              ) : mode === 'as_user' ? (
                <div className="flex items-center gap-0.5 rounded-full bg-[var(--bg)] p-0.5">
                  <button
                    className="btn btn-ghost btn-sm btn-circle text-[var(--fg-muted)]"
                    onClick={onImpersonate}
                    aria-label="Impersonate"
                    title="Let the AI draft your next message (fills the box)"
                  >
                    <Wand2 size={16} />
                  </button>
                  <button
                    className="btn btn-circle btn-sm btn-primary"
                    onClick={submit}
                    disabled={!draft.trim()}
                    aria-label="Send"
                  >
                    <ArrowUp size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 rounded-full bg-[var(--bg)] p-0.5">
                  <button
                    className="btn btn-ghost btn-sm gap-1 text-[var(--fg-muted)]"
                    onClick={submit}
                    disabled={!draft.trim()}
                    title="Add to the transcript without generating"
                  >
                    <Plus size={14} /> Add
                  </button>
                  <button
                    className="btn btn-circle btn-sm btn-primary"
                    onClick={() => onGenerate()}
                    aria-label="Continue"
                    title="Generate the AI's response"
                  >
                    <Play size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
