import { getPromptOrder, setPromptOrder } from '@/lib/db/repos/settings';
import { promptOrderSchema } from '@/lib/api/schemas';
import { json, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return json({ order: getPromptOrder() });
}

export async function PATCH(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req, promptOrderSchema);
    setPromptOrder(body.order);
    return json({ order: getPromptOrder() });
  } catch (e) {
    return handleError(e);
  }
}
