import { branchChat } from '@/lib/db/repos/chats';
import { branchSchema } from '@/lib/api/schemas';
import { json, apiError, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const body = await parseBody(req, branchSchema);
    const chat = branchChat(id, body.messageId);
    if (!chat) return apiError('Chat or message not found', 404);
    return json({ chat }, 201);
  } catch (e) {
    return handleError(e);
  }
}
