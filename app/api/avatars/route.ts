import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { avatarsDir } from '@/lib/db/index';
import { isPng } from '@/lib/cards/png';
import { json, apiError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return apiError('No file', 400);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!isPng(buffer)) return apiError('Avatar must be PNG', 400);
  const name = `${nanoid()}.png`;
  writeFileSync(join(avatarsDir(), name), buffer);
  return json({ avatar_path: name }, 201);
}
