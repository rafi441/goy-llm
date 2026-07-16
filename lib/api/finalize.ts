import type { MessageInput } from '../db/repos/messages';
import type { PlayMode } from '../types';

export function generationFinalizeInput(
  genMode: PlayMode,
  chatId: string,
  fullText: string,
): MessageInput | null {
  if (genMode === 'as_user') return null; // impersonation streams to the composer, never persisted
  return {
    chat_id: chatId,
    role: 'assistant',
    type: genMode === 'narrator' ? 'narration' : 'chat',
    mode: genMode === 'narrator' ? 'narrator' : null,
    swipes: [fullText],
  };
}
