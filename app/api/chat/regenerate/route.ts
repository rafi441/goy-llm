import { assemblePrompt } from '@/lib/prompt/assemble';
import { appendSwipe, getMessage } from '@/lib/db/repos/messages';
import { streamChat } from '@/lib/api/stream';
import { regenerateSchema } from '@/lib/api/schemas';
import { apiError, handleError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  let body;
  try {
    body = regenerateSchema.parse(await req.json());
  } catch (e) {
    return handleError(e);
  }

  const target = getMessage(body.messageId);
  if (!target || target.role !== 'assistant') return apiError('Assistant message not found', 404);

  try {
    const assembled = await assemblePrompt(body.chatId, {
      excludeMessageIds: [body.messageId],
    });
    return streamChat({
      assembled,
      signal: req.signal,
      finalize: (fullText) => {
        const updated = appendSwipe(body.messageId, fullText);
        return { messageId: body.messageId, swipeIndex: updated ? updated.swipe_index : 0 };
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
