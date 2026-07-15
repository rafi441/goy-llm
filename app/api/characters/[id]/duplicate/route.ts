import { duplicateCharacter } from '@/lib/db/repos/characters';
import { json, apiError } from '@/lib/api/respond';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const created = duplicateCharacter(id);
  if (!created) return apiError('Character not found', 404);
  return json({ character: created }, 201);
}
