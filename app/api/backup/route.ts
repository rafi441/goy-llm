import { backupBuffer, restoreFromBuffer } from '@/lib/db/index';
import { apiError, json } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const buf = backupBuffer();
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="goyllm-backup.db"',
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return apiError('No file', 400);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 16).toString('utf8').replace(/\0.*$/, '') !== 'SQLite format 3') {
    return apiError('Not a valid SQLite database', 400);
  }
  restoreFromBuffer(buffer);
  return json({ ok: true });
}
