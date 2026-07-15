import { assemblePrompt } from '@/lib/prompt/assemble';
import { createMessage } from '@/lib/db/repos/messages';
import { getChat } from '@/lib/db/repos/chats';
import { streamChat } from '@/lib/api/stream';
import { chatMessageSchema } from '@/lib/api/schemas';
import { apiError, handleError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  let body;
  try {
    body = chatMessageSchema.parse(await req.json());
  } catch (e) {
    return handleError(e);
  }

  const chat = getChat(body.chatId);
  if (!chat) return apiError('Chat not found', 404);

  const mode = body.mode ?? 'as_user';
  if (body.content && body.content.trim() && mode === 'as_user') {
    createMessage({
      chat_id: body.chatId,
      role: 'user',
      type: 'chat',
      mode: 'as_user',
      swipes: [body.content],
    });
  }

  try {
    const assembled = await assemblePrompt(body.chatId, {
      directive: body.directive ?? null,
    });
    return streamChat({
      assembled,
      signal: req.signal,
      finalize: (fullText) => {
        const msg = createMessage({
          chat_id: body.chatId,
          role: 'assistant',
          type: 'chat',
          mode: null,
          swipes: [fullText],
        });
        return { messageId: msg.id, swipeIndex: 0 };
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
