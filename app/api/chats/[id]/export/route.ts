import { getChat } from '@/lib/db/repos/chats';
import { getCharacter } from '@/lib/db/repos/characters';
import { getPersona, getDefaultPersona } from '@/lib/db/repos/personas';
import { listMessages, currentContent } from '@/lib/db/repos/messages';
import { apiError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const chat = getChat(id);
  if (!chat) return apiError('Chat not found', 404);

  const format = new URL(req.url).searchParams.get('format') ?? 'jsonl';
  const character = chat.character_id ? getCharacter(chat.character_id) : null;
  const persona = chat.persona_id ? getPersona(chat.persona_id) : getDefaultPersona();
  const messages = listMessages(id).filter((m) => m.type !== 'directive');

  const nameFor = (role: string) =>
    role === 'assistant' ? (character?.name ?? 'Character') : (persona?.name ?? 'User');

  if (format === 'md') {
    const lines = [`# ${chat.title}`, ''];
    for (const m of messages) lines.push(`**${nameFor(m.role)}:** ${currentContent(m)}`, '');
    return textResponse(lines.join('\n'), 'text/markdown', `${chat.title}.md`);
  }

  if (format === 'txt') {
    const lines = messages.map((m) => `${nameFor(m.role)}: ${currentContent(m)}`);
    return textResponse(lines.join('\n\n'), 'text/plain', `${chat.title}.txt`);
  }

  const jsonl = [
    JSON.stringify({
      user_name: persona?.name ?? 'User',
      character_name: character?.name ?? 'Character',
      create_date: chat.created_at,
    }),
    ...messages.map((m) =>
      JSON.stringify({
        name: nameFor(m.role),
        is_user: m.role === 'user',
        mes: currentContent(m),
        send_date: m.created_at,
      }),
    ),
  ].join('\n');
  return textResponse(jsonl, 'application/jsonl', `${chat.title}.jsonl`);
}

function textResponse(body: string, contentType: string, filename: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': `${contentType}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.\- ]/g, '_')}"`,
    },
  });
}
