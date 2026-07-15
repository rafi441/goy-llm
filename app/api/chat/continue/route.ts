import { assemblePrompt } from '@/lib/prompt/assemble';
import { getMessage, updateMessage } from '@/lib/db/repos/messages';
import { streamChat } from '@/lib/api/stream';
import { continueSchema } from '@/lib/api/schemas';
import { apiError, handleError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  let body;
  try {
    body = continueSchema.parse(await req.json());
  } catch (e) {
    return handleError(e);
  }

  const target = getMessage(body.messageId);
  if (!target || target.role !== 'assistant') return apiError('Assistant message not found', 404);
  const seed = target.swipes[target.swipe_index] ?? '';
  const swipeIndex = target.swipe_index;

  try {
    const assembled = await assemblePrompt(body.chatId, { upToMessageId: body.messageId });
    return streamChat({
      assembled,
      signal: req.signal,
      seedText: seed.endsWith(' ') || seed.endsWith('\n') ? seed : `${seed} `,
      finalize: (fullText) => {
        const swipes = [...target.swipes];
        swipes[swipeIndex] = fullText;
        updateMessage(body.messageId, { swipes, swipe_index: swipeIndex });
        return { messageId: body.messageId, swipeIndex };
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
