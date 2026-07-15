import { listDocuments, deleteDocument } from '@/lib/db/repos/rag';
import { json, apiError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const chatId = new URL(req.url).searchParams.get('chatId');
  if (!chatId) return apiError('chatId required', 400);
  return json({ documents: listDocuments(chatId) });
}

export async function DELETE(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return apiError('id required', 400);
  deleteDocument(id);
  return json({ ok: true });
}
