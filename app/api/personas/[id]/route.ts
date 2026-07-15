import { getPersona, updatePersona, deletePersona } from '@/lib/db/repos/personas';
import { personaSchema } from '@/lib/api/schemas';
import { json, apiError, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const persona = getPersona(id);
  if (!persona) return apiError('Persona not found', 404);
  return json({ persona });
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const body = await parseBody(req, personaSchema.partial());
    const updated = updatePersona(id, body);
    if (!updated) return apiError('Persona not found', 404);
    return json({ persona: updated });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  deletePersona(id);
  return json({ ok: true });
}
