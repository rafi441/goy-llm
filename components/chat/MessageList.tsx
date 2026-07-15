'use client';

import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown } from 'lucide-react';
import { useStream } from '@/lib/store/stream';
import { MessageItem } from './MessageItem';
import { DirectiveCard } from '@/components/director/DirectiveCard';
import type { Message } from '@/lib/types';

export interface MessageHandlers {
  onRegenerate: (m: Message) => void;
  onContinue: (m: Message) => void;
  onSwipe: (m: Message, index: number) => void;
  onEdit: (m: Message, text: string) => void;
  onDelete: (m: Message, fromHere: boolean) => void;
  onBranch: (m: Message) => void;
  onDirectiveToggle: (m: Message, pinned: boolean) => void;
}

interface Props extends MessageHandlers {
  chatId: string;
  messages: Message[];
  characterName: string;
  avatarPath: string | null;
}

const STREAMING_ID = '__streaming__';

export function MessageList(props: Props) {
  const { messages, chatId } = props;
  const stream = useStream();
  const parentRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);

  const showStreamingBubble =
    stream.running && stream.kind === 'new' && stream.chatId === chatId;

  const items: Message[] = showStreamingBubble
    ? [
        ...messages,
        {
          id: STREAMING_ID,
          chat_id: chatId,
          role: 'assistant',
          type: 'chat',
          mode: null,
          swipes: [stream.text],
          swipe_index: 0,
          pinned_directive: 0,
          token_count: null,
          created_at: 0,
          updated_at: 0,
        },
      ]
    : messages;

  const lastAssistantIndex = (() => {
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i]!.role === 'assistant' && items[i]!.type === 'chat') return i;
    }
    return -1;
  })();

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 8,
    getItemKey: (index) => items[index]!.id,
  });

  useEffect(() => {
    if (!stick) return;
    virtualizer.scrollToIndex(items.length - 1, { align: 'end' });
  }, [items.length, stream.text, stick, virtualizer]);

  const onScroll = () => {
    const el = parentRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStick(distance < 120);
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={parentRef}
        onScroll={onScroll}
        className="scrollbar-thin h-full overflow-y-auto"
      >
        <div className="mx-auto max-w-[46rem] px-4" style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const m = items[vItem.index]!;
            const isStreamingTarget =
              stream.running &&
              (stream.kind === 'regen' || stream.kind === 'continue') &&
              stream.targetMessageId === m.id;
            return (
              <div
                key={vItem.key}
                data-index={vItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vItem.start}px)`,
                }}
              >
                {m.type === 'directive' ? (
                  <DirectiveCard
                    message={m}
                    onTogglePin={(pinned) => props.onDirectiveToggle(m, pinned)}
                    onDelete={() => props.onDelete(m, false)}
                  />
                ) : (
                  <MessageItem
                    message={m}
                    characterName={props.characterName}
                    avatarPath={props.avatarPath}
                    isLastAssistant={vItem.index === lastAssistantIndex}
                    streamingText={isStreamingTarget ? stream.text : null}
                    ephemeral={m.id === STREAMING_ID}
                    handlers={props}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!stick && (
        <button
          className="btn btn-circle btn-sm absolute bottom-4 left-1/2 -translate-x-1/2 border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg"
          onClick={() => {
            setStick(true);
            virtualizer.scrollToIndex(items.length - 1, { align: 'end' });
          }}
          aria-label="Scroll to bottom"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  );
}
