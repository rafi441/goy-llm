import { getConnection } from '@/lib/db/repos/connections';
import { setModelPref } from '@/lib/db/repos/models';
import { modelPrefSchema } from '@/lib/api/schemas';
import { json, apiError, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { id } = await ctx.params;
    if (!getConnection(id)) return apiError('Connection not found', 404);
    const body = await parseBody(req, modelPrefSchema);
    setModelPref(id, body.model_id, {
      alias: body.alias,
      hidden: body.hidden,
      favorite: body.favorite,
    });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
