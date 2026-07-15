import { getChat, updateChat } from '@/lib/db/repos/chats';
import { listMessages, currentContent } from '@/lib/db/repos/messages';
import { getConnection, getDecryptedKey } from '@/lib/db/repos/connections';
import { getBehavior } from '@/lib/db/repos/settings';
import { getProvider } from '@/lib/providers';
import { json, apiError, handleError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const chat = getChat(id);
  if (!chat) return apiError('Chat not found', 404);

  const behavior = getBehavior();
  const connectionId = behavior.utility_connection_id ?? chat.connection_id;
  const modelId = behavior.utility_model_id ?? chat.model_id;
  if (!connectionId || !modelId) return apiError('No model available for titling', 400);
  const connection = getConnection(connectionId);
  if (!connection) return apiError('Connection unavailable', 400);

  const first = listMessages(id)
    .filter((m) => m.type === 'chat')
    .slice(0, 2)
    .map((m) => `${m.role}: ${currentContent(m)}`)
    .join('\n');

  const provider = getProvider(connection.type, connection.base_url, getDecryptedKey(connection.id));
  try {
    let full = '';
    for await (const chunk of provider.chat({
      model: modelId,
      messages: [
        {
          role: 'system',
          content:
            'Generate a very short chat title (3 to 5 words), no quotes, no punctuation at the end. Reply with the title only.',
        },
        { role: 'user', content: first },
      ],
      config: { temperature: 0.5, max_tokens: 20 },
    })) {
      full += chunk.delta;
      if (chunk.done) break;
    }
    const title = full.trim().replace(/^["']|["']$/g, '').split('\n')[0]?.slice(0, 60) || chat.title;
    const updated = updateChat(id, { title });
    return json({ chat: updated });
  } catch (e) {
    return handleError(e);
  }
}
