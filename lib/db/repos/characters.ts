import 'server-only';
import { nanoid } from 'nanoid';
import { getDb, now } from '../index';
import type { Character, CharacterBook, CardSpec } from '../../types';

interface CharRow {
  id: string;
  name: string;
  avatar_path: string | null;
  spec: string;
  description: string | null;
  personality: string | null;
  scenario: string | null;
  first_mes: string | null;
  mes_example: string | null;
  creator_notes: string | null;
  system_prompt: string | null;
  post_history_instructions: string | null;
  alternate_greetings: string | null;
  tags: string | null;
  creator: string | null;
  character_version: string | null;
  character_book: string | null;
  extensions: string | null;
  created_at: number;
  updated_at: number;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToChar(r: CharRow): Character {
  return {
    id: r.id,
    name: r.name,
    avatar_path: r.avatar_path,
    spec: (r.spec as CardSpec) || 'chara_card_v3',
    description: r.description ?? '',
    personality: r.personality ?? '',
    scenario: r.scenario ?? '',
    first_mes: r.first_mes ?? '',
    mes_example: r.mes_example ?? '',
    creator_notes: r.creator_notes ?? '',
    system_prompt: r.system_prompt ?? '',
    post_history_instructions: r.post_history_instructions ?? '',
    alternate_greetings: parseJson<string[]>(r.alternate_greetings, []),
    tags: parseJson<string[]>(r.tags, []),
    creator: r.creator ?? '',
    character_version: r.character_version ?? '',
    character_book: parseJson<CharacterBook | null>(r.character_book, null),
    extensions: parseJson<Record<string, unknown>>(r.extensions, {}),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function listCharacters(): Character[] {
  const rows = getDb()
    .prepare('SELECT * FROM characters ORDER BY name COLLATE NOCASE ASC')
    .all() as CharRow[];
  return rows.map(rowToChar);
}

export function getCharacter(id: string): Character | undefined {
  const r = getDb().prepare('SELECT * FROM characters WHERE id = ?').get(id) as CharRow | undefined;
  return r ? rowToChar(r) : undefined;
}

export type CharacterInput = Partial<Omit<Character, 'id' | 'created_at' | 'updated_at'>> & {
  name: string;
};

function serialize(c: CharacterInput) {
  return {
    name: c.name,
    avatar_path: c.avatar_path ?? null,
    spec: c.spec ?? 'chara_card_v3',
    description: c.description ?? '',
    personality: c.personality ?? '',
    scenario: c.scenario ?? '',
    first_mes: c.first_mes ?? '',
    mes_example: c.mes_example ?? '',
    creator_notes: c.creator_notes ?? '',
    system_prompt: c.system_prompt ?? '',
    post_history_instructions: c.post_history_instructions ?? '',
    alternate_greetings: JSON.stringify(c.alternate_greetings ?? []),
    tags: JSON.stringify(c.tags ?? []),
    creator: c.creator ?? '',
    character_version: c.character_version ?? '',
    character_book: c.character_book ? JSON.stringify(c.character_book) : null,
    extensions: JSON.stringify(c.extensions ?? {}),
  };
}

export function createCharacter(input: CharacterInput): Character {
  const id = nanoid();
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO characters (id, name, avatar_path, spec, description, personality, scenario,
        first_mes, mes_example, creator_notes, system_prompt, post_history_instructions,
        alternate_greetings, tags, creator, character_version, character_book, extensions, created_at, updated_at)
       VALUES (@id, @name, @avatar_path, @spec, @description, @personality, @scenario,
        @first_mes, @mes_example, @creator_notes, @system_prompt, @post_history_instructions,
        @alternate_greetings, @tags, @creator, @character_version, @character_book, @extensions, @ts, @ts)`,
    )
    .run({ id, ts, ...serialize(input) });
  return getCharacter(id)!;
}

export function updateCharacter(id: string, input: CharacterInput): Character | undefined {
  if (!getCharacter(id)) return undefined;
  getDb()
    .prepare(
      `UPDATE characters SET name=@name, avatar_path=@avatar_path, spec=@spec, description=@description,
        personality=@personality, scenario=@scenario, first_mes=@first_mes, mes_example=@mes_example,
        creator_notes=@creator_notes, system_prompt=@system_prompt, post_history_instructions=@post_history_instructions,
        alternate_greetings=@alternate_greetings, tags=@tags, creator=@creator, character_version=@character_version,
        character_book=@character_book, extensions=@extensions, updated_at=@ts WHERE id=@id`,
    )
    .run({ id, ts: now(), ...serialize(input) });
  return getCharacter(id);
}

export function duplicateCharacter(id: string): Character | undefined {
  const c = getCharacter(id);
  if (!c) return undefined;
  return createCharacter({ ...c, name: `${c.name} (copy)` });
}

export function deleteCharacter(id: string): void {
  getDb().prepare('DELETE FROM characters WHERE id = ?').run(id);
}
