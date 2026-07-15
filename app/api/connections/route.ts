import { listMaskedConnections, createConnection } from '@/lib/db/repos/connections';
import { connectionCreateSchema } from '@/lib/api/schemas';
import { json, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return json({ connections: listMaskedConnections() });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req, connectionCreateSchema);
    const created = createConnection(body);
    return json({ connection: created }, 201);
  } catch (e) {
    return handleError(e);
  }
}
