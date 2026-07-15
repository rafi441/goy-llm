import { z } from 'zod';
import { listLorebooks, createLorebook } from '@/lib/db/repos/lorebooks';
import { json, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().min(1),
  scope: z.enum(['global', 'character']),
  character_id: z.string().nullable().optional(),
});

export async function GET(): Promise<Response> {
  return json({ lorebooks: listLorebooks() });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req, schema);
    return json({ lorebook: createLorebook(body.name, body.scope, body.character_id ?? null) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
