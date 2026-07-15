import {
  getMaskedConnection,
  updateConnection,
  deleteConnection,
  countChatsUsingConnection,
} from '@/lib/db/repos/connections';
import { connectionPatchSchema } from '@/lib/api/schemas';
import { json, apiError, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const conn = getMaskedConnection(id);
  if (!conn) return apiError('Connection not found', 404);
  return json({ connection: conn });
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const body = await parseBody(req, connectionPatchSchema);
    const updated = updateConnection(id, body);
    if (!updated) return apiError('Connection not found', 404);
    return json({ connection: updated });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const confirmed = url.searchParams.get('confirm') === '1';
  const affected = countChatsUsingConnection(id);
  if (!confirmed) {
    return json({ requiresConfirm: true, affectedChats: affected });
  }
  deleteConnection(id);
  return json({ ok: true, affectedChats: affected });
}
