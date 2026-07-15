import { getCharacter, updateCharacter, deleteCharacter } from '@/lib/db/repos/characters';
import { characterSchema } from '@/lib/api/schemas';
import { json, apiError, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const character = getCharacter(id);
  if (!character) return apiError('Character not found', 404);
  return json({ character });
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const body = await parseBody(req, characterSchema);
    const updated = updateCharacter(id, body);
    if (!updated) return apiError('Character not found', 404);
    return json({ character: updated });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  deleteCharacter(id);
  return json({ ok: true });
}
