import { getMessage, updateMessage, deleteMessage, deleteFromHere } from '@/lib/db/repos/messages';
import { messagePatchSchema } from '@/lib/api/schemas';
import { json, apiError, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const body = await parseBody(req, messagePatchSchema);
    const updated = updateMessage(id, {
      swipes: body.swipes,
      swipe_index: body.swipe_index,
      mode: body.mode,
      pinned_directive: body.pinned_directive,
    });
    if (!updated) return apiError('Message not found', 404);
    return json({ message: updated });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const message = getMessage(id);
  if (!message) return apiError('Message not found', 404);
  const fromHere = new URL(req.url).searchParams.get('from_here') === '1';
  if (fromHere) {
    const count = deleteFromHere(id);
    return json({ ok: true, deleted: count });
  }
  deleteMessage(id);
  return json({ ok: true, deleted: 1 });
}
