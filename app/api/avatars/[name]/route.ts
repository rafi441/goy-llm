import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { avatarsDir } from '@/lib/db/index';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ name: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { name } = await ctx.params;
  const safe = basename(name);
  const p = join(avatarsDir(), safe);
  if (!existsSync(p)) return new Response('Not found', { status: 404 });
  const buf = readFileSync(p);
  return new Response(new Uint8Array(buf), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
  });
}
