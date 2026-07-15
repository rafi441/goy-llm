import { getBehavior, setBehavior } from '@/lib/db/repos/settings';
import { behaviorSchema } from '@/lib/api/schemas';
import { json, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return json({ behavior: getBehavior() });
}

export async function PATCH(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req, behaviorSchema);
    return json({ behavior: setBehavior(body) });
  } catch (e) {
    return handleError(e);
  }
}
