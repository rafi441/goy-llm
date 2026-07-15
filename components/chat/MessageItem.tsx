'use client';

import { useState } from 'react';
import {
  Copy,
  Pencil,
  RefreshCw,
  GitBranch,
  Trash2,
  CornerDownRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { MarkdownMessage } from './MarkdownMessage';
import { useUi } from '@/lib/store/ui';
import type { Message } from '@/lib/types';
import type { MessageHandlers } from './MessageList';

interface Props {
  message: Message;
  characterName: string;
  avatarPath: string | null;
  isLastAssistant: boolean;
  streamingText: string | null;
  streamingStatus: string | null;
  ephemeral: boolean;
  handlers: MessageHandlers;
}

export function MessageItem({
  message,
  characterName,
  avatarPath,
  isLastAssistant,
  streamingText,
  streamingStatus,
  ephemeral,
  handlers,
}: Props) {
  const pushToast = useUi((s) => s.pushToast);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const content = streamingText ?? message.swipes[message.swipe_index] ?? '';
  const isUser = message.role === 'user';
  const isNarration = message.type === 'narration' || message.mode === 'narrator';
  const streaming = streamingText !== null || ephemeral;

  const startEdit = () => {
    setDraft(message.swipes[message.swipe_index] ?? '');
    setEditing(true);
  };

  const copy = () => {
    navigator.clipboard.writeText(content).then(() => pushToast('Copied', 'success'));
  };

  if (isNarration) {
    return (
      <div className="group py-3">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 px-4 py-2 text-center text-sm italic text-[var(--fg-muted)]">
          <MarkdownMessage content={content} />
        </div>
        {!ephemeral && (
          <Toolbar align="center">
            <ToolbarButton icon={Copy} label="Copy" onClick={copy} />
            <ToolbarButton icon={Pencil} label="Edit" onClick={startEdit} />
            <ToolbarButton icon={Trash2} label="Delete" onClick={() => handlers.onDelete(message, false)} destructive />
          </Toolbar>
        )}
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="group flex flex-col items-end py-4">
        <div className="max-w-[80%] rounded-3xl bg-[var(--bg-user-msg)] px-4 py-2.5 text-[var(--fg)]">
          {editing ? (
            <EditBox draft={draft} setDraft={setDraft} onCancel={() => setEditing(false)} onSave={() => {
              handlers.onEdit(message, draft);
              setEditing(false);
            }} />
          ) : (
            <MarkdownMessage content={content} />
          )}
        </div>
        {!editing && (
          <Toolbar align="end">
            <ToolbarButton icon={Copy} label="Copy" onClick={copy} />
            <ToolbarButton icon={Pencil} label="Edit" onClick={startEdit} />
            <ToolbarButton icon={Trash2} label="Delete from here" onClick={() => handlers.onDelete(message, true)} destructive />
          </Toolbar>
        )}
      </div>
    );
  }

  return (
    <div className="group flex gap-3 py-4">
      <Avatar path={avatarPath} name={characterName} size={30} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-sm font-semibold text-[var(--fg)]">{characterName}</div>
        {editing ? (
          <EditBox
            draft={draft}
            setDraft={setDraft}
            onCancel={() => setEditing(false)}
            onSave={() => {
              handlers.onEdit(message, draft);
              setEditing(false);
            }}
          />
        ) : (
          <div className={streaming && content === '' ? 'text-[var(--fg-subtle)]' : ''}>
            {content === '' && streaming ? (
              <span className="streaming-caret text-sm">{streamingStatus ?? 'Loading'}</span>
            ) : (
              <div className={streaming ? 'streaming-caret' : ''}>
                <MarkdownMessage content={content} />
              </div>
            )}
          </div>
        )}

        {!editing && !ephemeral && (
          <div className="flex items-center gap-1">
            {isLastAssistant && (
              <SwipeControl
                index={message.swipe_index}
                total={message.swipes.length}
                onPrev={() => handlers.onSwipe(message, message.swipe_index - 1)}
                onNext={() => handlers.onSwipe(message, message.swipe_index + 1)}
                onNew={() => handlers.onSwipe(message, message.swipes.length)}
              />
            )}
            <Toolbar align="start">
              <ToolbarButton icon={Copy} label="Copy" onClick={copy} />
              <ToolbarButton icon={Pencil} label="Edit" onClick={startEdit} />
              {isLastAssistant && (
                <>
                  <ToolbarButton icon={RefreshCw} label="Regenerate" onClick={() => handlers.onRegenerate(message)} />
                  <ToolbarButton icon={CornerDownRight} label="Continue" onClick={() => handlers.onContinue(message)} />
                </>
              )}
              <ToolbarButton icon={GitBranch} label="Branch" onClick={() => handlers.onBranch(message)} />
              <ToolbarButton icon={Trash2} label="Delete" onClick={() => handlers.onDelete(message, false)} destructive />
            </Toolbar>
          </div>
        )}
      </div>
    </div>
  );
}

function EditBox({
  draft,
  setDraft,
  onCancel,
  onSave,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <textarea
        autoFocus
        className="textarea min-h-24 w-full border-[var(--border)] bg-[var(--bg)] text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="btn btn-primary btn-xs gap-1" onClick={onSave}>
          <Check size={13} /> Save
        </button>
        <button className="btn btn-ghost btn-xs gap-1" onClick={onCancel}>
          <X size={13} /> Cancel
        </button>
      </div>
    </div>
  );
}

function Toolbar({ children, align }: { children: React.ReactNode; align: 'start' | 'center' | 'end' }) {
  const justify = align === 'end' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <div className={`mt-1 flex ${justify} gap-0.5 opacity-0 transition group-hover:opacity-100`}>
      {children}
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      className={`btn btn-ghost btn-xs btn-circle ${destructive ? 'text-[var(--fg-subtle)] hover:text-[var(--destructive)]' : 'text-[var(--fg-subtle)] hover:text-[var(--fg)]'}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon size={14} />
    </button>
  );
}

function SwipeControl({
  index,
  total,
  onPrev,
  onNext,
  onNew,
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onNew: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 text-xs text-[var(--fg-subtle)]">
      <button
        className="btn btn-ghost btn-xs btn-circle"
        onClick={onPrev}
        disabled={index === 0}
        aria-label="Previous variant"
      >
        <ChevronLeft size={13} />
      </button>
      <span className="tabular-nums">
        {index + 1}/{total}
      </span>
      {index === total - 1 ? (
        <button className="btn btn-ghost btn-xs btn-circle" onClick={onNew} aria-label="New variant">
          <Plus size={13} />
        </button>
      ) : (
        <button className="btn btn-ghost btn-xs btn-circle" onClick={onNext} aria-label="Next variant">
          <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}
