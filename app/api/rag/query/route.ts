import { z } from 'zod';
import { getConnection, getDecryptedKey } from '@/lib/db/repos/connections';
import { getBehavior } from '@/lib/db/repos/settings';
import { retrieve } from '@/lib/db/repos/rag';
import { getProvider } from '@/lib/providers';
import { json, apiError, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  chatId: z.string().min(1),
  query: z.string().min(1),
  topK: z.number().int().min(1).max(20).optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req, schema);
    const behavior = getBehavior();
    if (!behavior.embedding_connection_id || !behavior.embedding_model_id) {
      return apiError('Embedding provider not configured', 400);
    }
    const conn = getConnection(behavior.embedding_connection_id);
    if (!conn) return apiError('Embedding connection not found', 400);

    const provider = getProvider(conn.type, conn.base_url, getDecryptedKey(conn.id));
    const [vec] = await provider.embed([body.query], behavior.embedding_model_id);
    if (!vec) return json({ chunks: [] });

    const chunks = retrieve(
      body.chatId,
      vec,
      body.topK ?? behavior.rag_top_k,
      behavior.rag_threshold,
    );
    return json({ chunks });
  } catch (e) {
    return handleError(e);
  }
}
