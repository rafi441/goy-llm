import 'server-only';
import { nanoid } from 'nanoid';
import { getDb } from '../index';
import type { Lorebook, LorebookEntry, CharacterBook } from '../../types';

interface EntryRow {
  id: string;
  lorebook_id: string;
  keys: string | null;
  secondary_keys: string | null;
  content: string | null;
  insertion_order: number;
  position: string;
  enabled: number;
  constant: number;
  selective: number;
  case_sensitive: number;
  scan_depth: number;
}

function parseArr(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

function rowToEntry(r: EntryRow): LorebookEntry {
  return {
    id: r.id,
    lorebook_id: r.lorebook_id,
    keys: parseArr(r.keys),
    secondary_keys: parseArr(r.secondary_keys),
    content: r.content ?? '',
    insertion_order: r.insertion_order,
    position: r.position,
    enabled: r.enabled,
    constant: r.constant,
    selective: r.selective,
    case_sensitive: r.case_sensitive,
    scan_depth: r.scan_depth,
  };
}

export function listLorebooks(): Lorebook[] {
  return getDb().prepare('SELECT * FROM lorebooks ORDER BY name COLLATE NOCASE ASC').all() as Lorebook[];
}

export function getLorebook(id: string): Lorebook | undefined {
  return getDb().prepare('SELECT * FROM lorebooks WHERE id = ?').get(id) as Lorebook | undefined;
}

export function createLorebook(name: string, scope: 'global' | 'character', characterId?: string | null): Lorebook {
  const id = nanoid();
  getDb()
    .prepare('INSERT INTO lorebooks (id, name, scope, character_id) VALUES (?, ?, ?, ?)')
    .run(id, name, scope, characterId ?? null);
  return getLorebook(id)!;
}

export function deleteLorebook(id: string): void {
  getDb().prepare('DELETE FROM lorebooks WHERE id = ?').run(id);
}

export function listEntries(lorebookId: string): LorebookEntry[] {
  const rows = getDb()
    .prepare('SELECT * FROM lorebook_entries WHERE lorebook_id = ? ORDER BY insertion_order ASC')
    .all(lorebookId) as EntryRow[];
  return rows.map(rowToEntry);
}

export function entriesForCharacter(characterId: string | null): LorebookEntry[] {
  const books = getDb()
    .prepare("SELECT id FROM lorebooks WHERE scope = 'global' OR character_id = ?")
    .all(characterId) as { id: string }[];
  const out: LorebookEntry[] = [];
  for (const b of books) out.push(...listEntries(b.id));
  return out;
}

export type EntryInput = Partial<Omit<LorebookEntry, 'id' | 'lorebook_id'>>;

export function createEntry(lorebookId: string, input: EntryInput): LorebookEntry {
  const id = nanoid();
  getDb()
    .prepare(
      `INSERT INTO lorebook_entries (id, lorebook_id, keys, secondary_keys, content, insertion_order,
        position, enabled, constant, selective, case_sensitive, scan_depth)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      lorebookId,
      JSON.stringify(input.keys ?? []),
      JSON.stringify(input.secondary_keys ?? []),
      input.content ?? '',
      input.insertion_order ?? 100,
      input.position ?? 'before_char',
      input.enabled ?? 1,
      input.constant ?? 0,
      input.selective ?? 0,
      input.case_sensitive ?? 0,
      input.scan_depth ?? 4,
    );
  return getDb().prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(id) as unknown as LorebookEntry;
}

export function updateEntry(id: string, input: EntryInput): void {
  const r = getDb().prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(id) as EntryRow | undefined;
  if (!r) return;
  const cur = rowToEntry(r);
  getDb()
    .prepare(
      `UPDATE lorebook_entries SET keys=?, secondary_keys=?, content=?, insertion_order=?,
        position=?, enabled=?, constant=?, selective=?, case_sensitive=?, scan_depth=? WHERE id=?`,
    )
    .run(
      JSON.stringify(input.keys ?? cur.keys),
      JSON.stringify(input.secondary_keys ?? cur.secondary_keys),
      input.content ?? cur.content,
      input.insertion_order ?? cur.insertion_order,
      input.position ?? cur.position,
      input.enabled ?? cur.enabled,
      input.constant ?? cur.constant,
      input.selective ?? cur.selective,
      input.case_sensitive ?? cur.case_sensitive,
      input.scan_depth ?? cur.scan_depth,
      id,
    );
}

export function deleteEntry(id: string): void {
  getDb().prepare('DELETE FROM lorebook_entries WHERE id = ?').run(id);
}

export function importCharacterBook(characterId: string, book: CharacterBook): Lorebook {
  const lb = createLorebook(book.name || 'Character Lorebook', 'character', characterId);
  for (const e of book.entries ?? []) {
    createEntry(lb.id, {
      keys: e.keys ?? [],
      secondary_keys: e.secondary_keys ?? [],
      content: e.content ?? '',
      insertion_order: e.insertion_order ?? 100,
      position: e.position ?? 'before_char',
      enabled: e.enabled === false ? 0 : 1,
      constant: e.constant ? 1 : 0,
      selective: e.selective ? 1 : 0,
      case_sensitive: e.case_sensitive ? 1 : 0,
      scan_depth: e.scan_depth ?? book.scan_depth ?? 4,
    });
  }
  return lb;
}
