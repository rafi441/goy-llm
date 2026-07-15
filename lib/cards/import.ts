import 'server-only';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { avatarsDir } from '../db/index';
import { createCharacter } from '../db/repos/characters';
import { importCharacterBook } from '../db/repos/lorebooks';
import { extractCardText, isPng } from './png';
import { parseCardJson } from './normalize';
import type { Character } from '../types';

export interface ImportResult {
  ok: boolean;
  character?: Character;
  filename: string;
  warning?: string;
  error?: string;
}

function saveAvatar(buffer: Buffer): string {
  const name = `${nanoid()}.png`;
  writeFileSync(join(avatarsDir(), name), buffer);
  return name;
}

export function importCardFile(filename: string, buffer: Buffer): ImportResult {
  const lower = filename.toLowerCase();

  if (lower.endsWith('.png') || isPng(buffer)) {
    if (!isPng(buffer)) {
      return { ok: false, filename, error: 'File is not a valid PNG (wrong magic bytes)' };
    }
    const extracted = extractCardText(buffer);
    const avatar = saveAvatar(buffer);
    if (!extracted) {
      const character = createCharacter({
        name: filename.replace(/\.png$/i, ''),
        avatar_path: avatar,
      });
      return {
        ok: true,
        character,
        filename,
        warning: 'PNG has no character metadata — used as avatar only, fill in fields manually.',
      };
    }
    try {
      const parsed = parseCardJson(JSON.parse(extracted.raw));
      const character = createCharacter({ ...parsed.input, avatar_path: avatar });
      if (parsed.characterBook) importCharacterBook(character.id, parsed.characterBook);
      return { ok: true, character, filename };
    } catch (e) {
      return {
        ok: false,
        filename,
        error: `Corrupt character metadata: ${e instanceof Error ? e.message : 'invalid JSON'}`,
      };
    }
  }

  if (lower.endsWith('.json') || buffer[0] === 0x7b) {
    try {
      const parsed = parseCardJson(JSON.parse(buffer.toString('utf8')));
      const character = createCharacter(parsed.input);
      if (parsed.characterBook) importCharacterBook(character.id, parsed.characterBook);
      return { ok: true, character, filename };
    } catch (e) {
      return {
        ok: false,
        filename,
        error: `Corrupt JSON: ${e instanceof Error ? e.message : 'parse failed'}`,
      };
    }
  }

  return { ok: false, filename, error: 'Unsupported format (needs .png or .json)' };
}
