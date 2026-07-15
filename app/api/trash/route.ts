import { z } from 'zod';
import { listTrash, restoreChat, hardDeleteChat, purgeExpiredTrash } from '@/lib/db/repos/chats';
import { json, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  action: z.enum(['restore', 'purge', 'purge_expired']),
  chatId: z.string().optional(),
});

export async function GET(): Promise<Response> {
  purgeExpiredTrash(30);
  return json({ chats: listTrash() });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req, actionSchema);
    if (body.action === 'restore' && body.chatId) restoreChat(body.chatId);
    else if (body.action === 'purge' && body.chatId) hardDeleteChat(body.chatId);
    else if (body.action === 'purge_expired') purgeExpiredTrash(30);
    return json({ chats: listTrash() });
  } catch (e) {
    return handleError(e);
  }
}
