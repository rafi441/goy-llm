import { getConnection, getDecryptedKey } from '@/lib/db/repos/connections';
import { getProvider, ProviderError } from '@/lib/providers';
import { json, apiError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const conn = getConnection(id);
  if (!conn) return apiError('Connection not found', 404);

  const provider = getProvider(conn.type, conn.base_url, getDecryptedKey(id));
  try {
    const models = await provider.listModels();
    return json({ ok: true, modelCount: models.length });
  } catch (e) {
    const message = e instanceof ProviderError ? e.message : e instanceof Error ? e.message : 'Test failed';
    return json({ ok: false, error: message });
  }
}
