import { searchMessages } from '@/lib/db/repos/messages';
import { listChats } from '@/lib/db/repos/chats';
import { json } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (!q) return json({ chats: [], messages: [] });

  const chats = listChats(true);
  const lower = q.toLowerCase();
  const titleHits = chats.filter((c) => c.title.toLowerCase().includes(lower));

  const messageHits = searchMessages(q, 30);
  const chatById = new Map(chats.map((c) => [c.id, c]));
  const messageResults = messageHits
    .map((h) => {
      const chat = chatById.get(h.chat_id);
      return chat ? { chatId: h.chat_id, title: chat.title, snippet: h.snippet } : null;
    })
    .filter((x): x is { chatId: string; title: string; snippet: string } => x !== null);

  return json({ chats: titleHits, messages: messageResults });
}
