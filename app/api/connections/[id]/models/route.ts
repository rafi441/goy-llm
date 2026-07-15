import { getConnection, getDecryptedKey } from '@/lib/db/repos/connections';
import {
  getConnectionModelsWithPrefs,
  isCacheFresh,
  saveModels,
} from '@/lib/db/repos/models';
import { getProvider, ProviderError, getCapabilities } from '@/lib/providers';
import { json, apiError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const conn = getConnection(id);
  if (!conn) return apiError('Connection not found', 404);

  const url = new URL(req.url);
  const refresh = url.searchParams.get('refresh') === '1';

  if (!refresh && isCacheFresh(id)) {
    return json({
      models: getConnectionModelsWithPrefs(id, conn.name),
      capabilities: getCapabilities(conn.type),
      cached: true,
    });
  }

  const provider = getProvider(conn.type, conn.base_url, getDecryptedKey(id));
  try {
    const discovered = await provider.listModels();
    saveModels(
      id,
      discovered.map((m) => ({
        model_id: m.model_id,
        display_name: m.display_name,
        context_length: m.context_length,
        metadata: m.metadata,
      })),
    );
    return json({
      models: getConnectionModelsWithPrefs(id, conn.name),
      capabilities: getCapabilities(conn.type),
      cached: false,
    });
  } catch (e) {
    const message = e instanceof ProviderError ? e.message : e instanceof Error ? e.message : 'Fetch failed';
    const cached = getConnectionModelsWithPrefs(id, conn.name);
    return json(
      { models: cached, capabilities: getCapabilities(conn.type), cached: true, error: message },
      cached.length ? 200 : 502,
    );
  }
}
