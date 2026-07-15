import 'server-only';
import { nanoid } from 'nanoid';
import { getDb, now } from '../index';
import type { Persona } from '../../types';

export function listPersonas(): Persona[] {
  return getDb()
    .prepare('SELECT * FROM personas ORDER BY is_default DESC, name COLLATE NOCASE ASC')
    .all() as Persona[];
}

export function getPersona(id: string): Persona | undefined {
  return getDb().prepare('SELECT * FROM personas WHERE id = ?').get(id) as Persona | undefined;
}

export function getDefaultPersona(): Persona | undefined {
  return getDb().prepare('SELECT * FROM personas WHERE is_default = 1 LIMIT 1').get() as
    | Persona
    | undefined;
}

export interface PersonaInput {
  name: string;
  avatar_path?: string | null;
  description?: string;
  is_default?: boolean;
}

export function createPersona(input: PersonaInput): Persona {
  const id = nanoid();
  const db = getDb();
  const tx = db.transaction(() => {
    if (input.is_default) db.prepare('UPDATE personas SET is_default = 0').run();
    db.prepare(
      `INSERT INTO personas (id, name, avatar_path, description, is_default, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, input.name, input.avatar_path ?? null, input.description ?? '', input.is_default ? 1 : 0, now());
  });
  tx();
  return getPersona(id)!;
}

export function updatePersona(id: string, input: Partial<PersonaInput>): Persona | undefined {
  const existing = getPersona(id);
  if (!existing) return undefined;
  const db = getDb();
  const tx = db.transaction(() => {
    if (input.is_default) db.prepare('UPDATE personas SET is_default = 0').run();
    db.prepare(
      `UPDATE personas SET name=@name, avatar_path=@avatar_path, description=@description, is_default=@is_default WHERE id=@id`,
    ).run({
      id,
      name: input.name ?? existing.name,
      avatar_path: input.avatar_path !== undefined ? input.avatar_path : existing.avatar_path,
      description: input.description ?? existing.description,
      is_default: input.is_default === undefined ? existing.is_default : input.is_default ? 1 : 0,
    });
  });
  tx();
  return getPersona(id);
}

export function deletePersona(id: string): void {
  getDb().prepare('DELETE FROM personas WHERE id = ?').run(id);
}
