import { listConnections } from '@/lib/db/repos/connections';
import { getPickerModels } from '@/lib/db/repos/models';
import { json } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const connections = listConnections();
  const names = new Map(connections.map((c) => [c.id, c.name]));
  const enabledIds = new Set(connections.filter((c) => c.enabled === 1).map((c) => c.id));
  const models = getPickerModels(names).filter((m) => enabledIds.has(m.connection_id));
  return json({ models });
}
