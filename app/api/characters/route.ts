import { listCharacters, createCharacter } from '@/lib/db/repos/characters';
import { importCharacterBook } from '@/lib/db/repos/lorebooks';
import { characterSchema } from '@/lib/api/schemas';
import { json, handleError, parseBody } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return json({ characters: listCharacters() });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req, characterSchema);
    const created = createCharacter(body);
    if (created.character_book) importCharacterBook(created.id, created.character_book);
    return json({ character: created }, 201);
  } catch (e) {
    return handleError(e);
  }
}
