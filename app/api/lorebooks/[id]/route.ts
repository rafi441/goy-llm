import { z } from 'zod';
import { getLorebook, deleteLorebook, listEntries, createEntry } from '@/lib/db/repos/lorebooks';
import { json, apiError, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

const entrySchema = z.object({
  keys: z.array(z.string()).optional(),
  secondary_keys: z.array(z.string()).optional(),
  content: z.string().optional(),
  insertion_order: z.number().int().optional(),
  position: z.string().optional(),
  enabled: z.number().int().optional(),
  constant: z.number().int().optional(),
  selective: z.number().int().optional(),
  case_sensitive: z.number().int().optional(),
  scan_depth: z.number().int().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const lorebook = getLorebook(id);
  if (!lorebook) return apiError('Lorebook not found', 404);
  return json({ lorebook, entries: listEntries(id) });
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { id } = await ctx.params;
    if (!getLorebook(id)) return apiError('Lorebook not found', 404);
    const body = await parseBody(req, entrySchema);
    return json({ entry: createEntry(id, body) }, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  deleteLorebook(id);
  return json({ ok: true });
}
