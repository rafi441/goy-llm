import { getChat, updateChat, softDeleteChat } from '@/lib/db/repos/chats';
import { listMessages } from '@/lib/db/repos/messages';
import { chatPatchSchema } from '@/lib/api/schemas';
import { json, apiError, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const chat = getChat(id);
  if (!chat) return apiError('Chat not found', 404);
  return json({ chat, messages: listMessages(id) });
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const body = await parseBody(req, chatPatchSchema);
    const updated = updateChat(id, body);
    if (!updated) return apiError('Chat not found', 404);
    return json({ chat: updated });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  softDeleteChat(id);
  return json({ ok: true });
}
