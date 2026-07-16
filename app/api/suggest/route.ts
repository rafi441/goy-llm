import { getChat } from '@/lib/db/repos/chats';
import { getCharacter } from '@/lib/db/repos/characters';
import { getPersona, getDefaultPersona } from '@/lib/db/repos/personas';
import { listMessages, currentContent } from '@/lib/db/repos/messages';
import { getConnection, getDecryptedKey } from '@/lib/db/repos/connections';
import { getBehavior } from '@/lib/db/repos/settings';
import { entriesForCharacter } from '@/lib/db/repos/lorebooks';
import { getProvider } from '@/lib/providers';
import { resolveMacros, makeMacroContext } from '@/lib/prompt/macros';
import { scanLorebook } from '@/lib/prompt/lorebook';
import { buildSuggestMessages } from '@/lib/prompt/suggest';
import { estimateTokens } from '@/lib/tokenizer';
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
  const ctx = makeMacroContext(character?.name ?? 'Character', persona?.name ?? 'User', persona?.description ?? '');
  const mm = (s: string | null | undefined) => resolveMacros(s ?? '', ctx);

  const msgs = listMessages(body.chatId).filter(
    (m) => m.type !== 'directive' || m.pinned_directive === 1,
  );
  const transcript = msgs
    .slice(-24)
    .map((m) =>
      m.type === 'directive'
        ? `[Director instruction: ${mm(currentContent(m))}]`
        : `${m.role}: ${mm(currentContent(m))}`,
    )
    .join('\n');

  const historyText = msgs.map((m) => currentContent(m));
  const lore = scanLorebook(entriesForCharacter(chat.character_id), historyText, 512, estimateTokens);

  const { system, user } = buildSuggestMessages(body.mode ?? 'as_user', {
    charName: character?.name ?? 'Unknown',
    charDescription: mm(character?.description),
    charPersonality: mm(character?.personality),
    charScenario: mm(character?.scenario),
    personaName: persona?.name ?? 'User',
    personaDescription: mm(persona?.description),
    authorNote: chat.author_note_enabled === 1 ? mm(chat.author_note) : '',
    lorebook: lore.active.map((e) => mm(e.content)),
    transcript,
  });

  const provider = getProvider(connection.type, connection.base_url, getDecryptedKey(connection.id));
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
