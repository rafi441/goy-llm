import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getCharacter } from '@/lib/db/repos/characters';
import { avatarsDir } from '@/lib/db/index';
import { serializeCardJson } from '@/lib/cards/normalize';
import { embedCardText } from '@/lib/cards/png';
import { apiError } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC',
  'base64',
);

interface Ctx {
  params: Promise<{ id: string }>;
}

function download(filename: string): string {
  return `attachment; filename="${filename.replace(/[^\w.\- ]/g, '_')}"`;
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const character = getCharacter(id);
  if (!character) return apiError('Character not found', 404);

  const format = new URL(req.url).searchParams.get('format') ?? 'png';

  if (format === 'json_v2' || format === 'json_v3') {
    const spec = format === 'json_v3' ? 'chara_card_v3' : 'chara_card_v2';
    const body = JSON.stringify(serializeCardJson(character, spec), null, 2);
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': download(`${character.name}.${format}.json`),
      },
    });
  }

  let base = PLACEHOLDER_PNG;
  if (character.avatar_path) {
    const p = join(avatarsDir(), character.avatar_path);
    if (existsSync(p)) base = readFileSync(p);
  }

  const v3 = JSON.stringify(serializeCardJson(character, 'chara_card_v3'));
  const v2 = JSON.stringify(serializeCardJson(character, 'chara_card_v2'));
  const png = embedCardText(base, [
    { keyword: 'chara', json: v2 },
    { keyword: 'ccv3', json: v3 },
  ]);

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': download(`${character.name}.card.png`),
    },
  });
}
