import 'server-only';
import { nanoid } from 'nanoid';
import { getDb } from '../index';
import type { GenConfig, Preset } from '../../types';

interface PresetRow {
  id: string;
  name: string;
  config: string;
  is_default: number;
}

function rowToPreset(r: PresetRow): Preset {
  let config: GenConfig = {};
  try {
    config = JSON.parse(r.config) as GenConfig;
  } catch {
    config = {};
  }
  return { id: r.id, name: r.name, config, is_default: r.is_default };
}

export function listPresets(): Preset[] {
  const rows = getDb()
    .prepare('SELECT * FROM presets ORDER BY is_default DESC, name COLLATE NOCASE ASC')
    .all() as PresetRow[];
  return rows.map(rowToPreset);
}

export function getPreset(id: string): Preset | undefined {
  const r = getDb().prepare('SELECT * FROM presets WHERE id = ?').get(id) as PresetRow | undefined;
  return r ? rowToPreset(r) : undefined;
}

export function getDefaultPreset(): Preset | undefined {
  const r = getDb().prepare('SELECT * FROM presets WHERE is_default = 1 LIMIT 1').get() as
    | PresetRow
    | undefined;
  return r ? rowToPreset(r) : undefined;
}

export interface PresetInput {
  name: string;
  config: GenConfig;
  is_default?: boolean;
}

export function createPreset(input: PresetInput): Preset {
  const id = nanoid();
  const db = getDb();
  const tx = db.transaction(() => {
    if (input.is_default) db.prepare('UPDATE presets SET is_default = 0').run();
    db.prepare('INSERT INTO presets (id, name, config, is_default) VALUES (?, ?, ?, ?)').run(
      id,
      input.name,
      JSON.stringify(input.config),
      input.is_default ? 1 : 0,
    );
  });
  tx();
  return getPreset(id)!;
}

export function updatePreset(id: string, input: Partial<PresetInput>): Preset | undefined {
  const existing = getPreset(id);
  if (!existing) return undefined;
  const db = getDb();
  const tx = db.transaction(() => {
    if (input.is_default) db.prepare('UPDATE presets SET is_default = 0').run();
    db.prepare('UPDATE presets SET name=@name, config=@config, is_default=@is_default WHERE id=@id').run({
      id,
      name: input.name ?? existing.name,
      config: JSON.stringify(input.config ?? existing.config),
      is_default: input.is_default === undefined ? existing.is_default : input.is_default ? 1 : 0,
    });
  });
  tx();
  return getPreset(id);
}

export function deletePreset(id: string): void {
  getDb().prepare('DELETE FROM presets WHERE id = ?').run(id);
}
