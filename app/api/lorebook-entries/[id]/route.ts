import { z } from 'zod';
import { updateEntry, deleteEntry } from '@/lib/db/repos/lorebooks';
import { json, handleError, parseBody } from '@/lib/api/respond';

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

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const body = await parseBody(req, entrySchema);
    updateEntry(id, body);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  deleteEntry(id);
  return json({ ok: true });
}
