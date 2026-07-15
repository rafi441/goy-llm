import { getPreset, updatePreset, deletePreset } from '@/lib/db/repos/presets';
import { presetSchema } from '@/lib/api/schemas';
import { json, apiError, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const preset = getPreset(id);
  if (!preset) return apiError('Preset not found', 404);
  return json({ preset });
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const body = await parseBody(req, presetSchema.partial());
    const updated = updatePreset(id, body);
    if (!updated) return apiError('Preset not found', 404);
    return json({ preset: updated });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  deletePreset(id);
  return json({ ok: true });
}
