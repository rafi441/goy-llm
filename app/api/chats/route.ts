import { listChats, createChat } from '@/lib/db/repos/chats';
import { getDefaultPreset } from '@/lib/db/repos/presets';
import { getCharacter } from '@/lib/db/repos/characters';
import { getDefaultPersona, getPersona } from '@/lib/db/repos/personas';
import { createMessage } from '@/lib/db/repos/messages';
import { resolveMacros, makeMacroContext } from '@/lib/prompt/macros';
import { chatCreateSchema } from '@/lib/api/schemas';
import { json, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const includeArchived = new URL(req.url).searchParams.get('archived') === '1';
  return json({ chats: listChats(includeArchived) });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req, chatCreateSchema);
    const defaultPreset = getDefaultPreset();
    const persona = body.persona_id ? undefined : getDefaultPersona();
    const chat = createChat({
      ...body,
      persona_id: body.persona_id ?? persona?.id ?? null,
      gen_config: body.gen_config ?? defaultPreset?.config ?? null,
    });

    if (body.character_id) {
      const character = getCharacter(body.character_id);
      if (character && character.first_mes.trim()) {
        const personaObj = body.persona_id ? getPersona(body.persona_id) : persona;
        const ctx = makeMacroContext(
          character.name,
          personaObj?.name ?? 'User',
          personaObj?.description ?? '',
        );
        const greetings = [character.first_mes, ...character.alternate_greetings].map((g) =>
          resolveMacros(g, ctx),
        );
        createMessage({
          chat_id: chat.id,
          role: 'assistant',
          type: 'chat',
          mode: null,
          swipes: greetings,
          swipe_index: 0,
        });
      }
    }
    return json({ chat }, 201);
  } catch (e) {
    return handleError(e);
  }
}
