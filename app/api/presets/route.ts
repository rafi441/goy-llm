import { listPresets, createPreset } from '@/lib/db/repos/presets';
import { presetSchema } from '@/lib/api/schemas';
import { json, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return json({ presets: listPresets() });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req, presetSchema);
    return json({ preset: createPreset(body) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
