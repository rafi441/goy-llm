import { getChat } from '@/lib/db/repos/chats';
import { getCharacter } from '@/lib/db/repos/characters';
import { getPersona, getDefaultPersona } from '@/lib/db/repos/personas';
import { listMessages, currentContent } from '@/lib/db/repos/messages';
import { getConnection, getDecryptedKey } from '@/lib/db/repos/connections';
import { getBehavior } from '@/lib/db/repos/settings';
import { getProvider } from '@/lib/providers';
import { suggestSchema } from '@/lib/api/schemas';
import { json, apiError, handleError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  let body;
  try {
    body = suggestSchema.parse(await req.json());
  } catch (e) {
    return handleError(e);
  }

  const chat = getChat(body.chatId);
  if (!chat) return apiError('Chat not found', 404);

  const behavior = getBehavior();
  const connectionId = behavior.utility_connection_id ?? chat.connection_id;
  const modelId = behavior.utility_model_id ?? chat.model_id;
  if (!connectionId || !modelId) return apiError('No model available for suggestions', 400);
  const connection = getConnection(connectionId);
  if (!connection) return apiError('Connection unavailable', 400);

  const character = chat.character_id ? getCharacter(chat.character_id) : null;
  const persona = chat.persona_id ? getPersona(chat.persona_id) : getDefaultPersona();
  const recent = listMessages(body.chatId)
    .filter((m) => m.type !== 'directive')
    .slice(-6)
    .map((m) => `${m.role}: ${currentContent(m)}`)
    .join('\n');

  const provider = getProvider(connection.type, connection.base_url, getDecryptedKey(connection.id));
  const system =
    'You generate short next-action suggestions for the player of a roleplay chat. ' +
    'Return ONLY a JSON array of 3 to 4 strings, each at most 15 words, phrased from the player\'s point of view. No prose, no explanation.';
  const user =
    `Character: ${character?.name ?? 'Unknown'}\n` +
    `Scenario: ${character?.scenario ?? ''}\n` +
    `Player persona: ${persona?.name ?? 'User'}\n\n` +
    `Recent messages:\n${recent}\n\nReturn the JSON array now.`;

  try {
    let full = '';
    for await (const chunk of provider.chat({
      model: modelId,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      config: { temperature: 0.8, max_tokens: 200 },
      signal: req.signal,
    })) {
      full += chunk.delta;
      if (chunk.done) break;
    }
    return json({ suggestions: parseSuggestions(full) });
  } catch (e) {
    return handleError(e);
  }
}

function parseSuggestions(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const arr = JSON.parse(match[0]) as unknown[];
      return arr.map(String).filter(Boolean).slice(0, 4);
    } catch {
      /* fall through */
    }
  }
  return text
    .split('\n')
    .map((l) => l.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 4);
}
