import { z } from 'zod';
import { getChat } from '@/lib/db/repos/chats';
import { listMessages, createMessage } from '@/lib/db/repos/messages';
import { json, apiError, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const addMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  type: z.enum(['chat', 'directive', 'narration']).optional(),
  mode: z.enum(['as_user', 'as_char', 'narrator']).nullable().optional(),
  content: z.string(),
  pinned_directive: z.boolean().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!getChat(id)) return apiError('Chat not found', 404);
  return json({ messages: listMessages(id) });
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { id } = await ctx.params;
    if (!getChat(id)) return apiError('Chat not found', 404);
    const body = await parseBody(req, addMessageSchema);
    const message = createMessage({
      chat_id: id,
      role: body.role,
      type: body.type ?? 'chat',
      mode: body.mode ?? null,
      swipes: [body.content],
      pinned_directive: body.pinned_directive,
    });
    return json({ message }, 201);
  } catch (e) {
    return handleError(e);
  }
}
