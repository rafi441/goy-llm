import { getChat } from '@/lib/db/repos/chats';
import { getCharacter } from '@/lib/db/repos/characters';
import { getPersona, getDefaultPersona } from '@/lib/db/repos/personas';
import { listMessages, currentContent, createMessage } from '@/lib/db/repos/messages';
import { getConnection, getDecryptedKey } from '@/lib/db/repos/connections';
import { getBehavior } from '@/lib/db/repos/settings';
import { entriesForCharacter } from '@/lib/db/repos/lorebooks';
import { getProvider } from '@/lib/providers';
import { resolveMacros, makeMacroContext } from '@/lib/prompt/macros';
import { scanLorebook } from '@/lib/prompt/lorebook';
import { buildDescribeMessages } from '@/lib/prompt/describe';
import { estimateTokens } from '@/lib/tokenizer';
import { describeSchema } from '@/lib/api/schemas';
import { json, apiError, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  let body;
  try {
    body = await parseBody(req, describeSchema);
  } catch (e) {
    return handleError(e);
  }

  const chat = getChat(body.chatId);
  if (!chat) return apiError('Chat not found', 404);

  const connectionId = chat.connection_id;
  const modelId = chat.model_id;
  if (!connectionId || !modelId) return apiError('No model available to describe', 400);
  const connection = getConnection(connectionId);
  if (!connection) return apiError('Connection unavailable', 400);

  const character = chat.character_id ? getCharacter(chat.character_id) : null;
  const persona = chat.persona_id ? getPersona(chat.persona_id) : getDefaultPersona();
  const ctx = makeMacroContext(
    character?.name ?? 'Character',
    persona?.name ?? 'User',
    persona?.description ?? '',
  );
  const mm = (s: string | null | undefined) => resolveMacros(s ?? '', ctx);

  const msgs = listMessages(body.chatId).filter(
    (m) => m.type !== 'directive' && m.type !== 'describe',
  );
  const transcript = msgs
    .slice(-24)
    .map((m) => `${m.role}: ${mm(currentContent(m))}`)
    .join('\n');

  const historyText = msgs.map((m) => currentContent(m));
  const lore = scanLorebook(entriesForCharacter(chat.character_id), historyText, 512, estimateTokens);

  const { system, user } = buildDescribeMessages(body.aspect, body.mode ?? 'as_char', {
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
      config: { temperature: 0.6, max_tokens: 220 },
      signal: req.signal,
    })) {
      full += chunk.delta;
      if (chunk.done) break;
    }

    const description = full.trim();
    if (!description) return apiError('The model returned an empty description. Try again.', 502);

    const label = body.aspect.trim();
    const message = createMessage({
      chat_id: body.chatId,
      role: 'system',
      type: 'describe',
      mode: null,
      swipes: [`**${label}** — ${description}`],
    });
    return json({ message }, 201);
  } catch (e) {
    return handleError(e);
  }
}
