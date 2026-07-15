import { listPersonas, createPersona } from '@/lib/db/repos/personas';
import { personaSchema } from '@/lib/api/schemas';
import { json, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return json({ personas: listPersonas() });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req, personaSchema);
    return json({ persona: createPersona(body) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
