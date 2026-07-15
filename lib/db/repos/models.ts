import 'server-only';
import { getDb, now } from '../index';
import type { ModelInfo, ModelMetadata, PickerModel } from '../../types';

const TTL_MS = 60 * 60 * 1000;

interface CacheRow {
  connection_id: string;
  model_id: string;
  display_name: string;
  context_length: number | null;
  metadata: string;
  fetched_at: number;
}

function rowToModel(r: CacheRow): ModelInfo {
  let metadata: ModelMetadata = {};
  try {
    metadata = JSON.parse(r.metadata) as ModelMetadata;
  } catch {
    metadata = {};
  }
  return {
    connection_id: r.connection_id,
    model_id: r.model_id,
    display_name: r.display_name,
    context_length: r.context_length,
    metadata,
    fetched_at: r.fetched_at,
  };
}

export function getCachedModels(connectionId: string): ModelInfo[] {
  const rows = getDb()
    .prepare('SELECT * FROM models_cache WHERE connection_id = ? ORDER BY display_name ASC')
    .all(connectionId) as CacheRow[];
  return rows.map(rowToModel);
}

export function isCacheFresh(connectionId: string): boolean {
  const row = getDb()
    .prepare('SELECT MAX(fetched_at) AS ts, COUNT(*) AS n FROM models_cache WHERE connection_id = ?')
    .get(connectionId) as { ts: number | null; n: number };
  if (!row.n || !row.ts) return false;
  return now() - row.ts < TTL_MS;
}

export function saveModels(
  connectionId: string,
  models: Omit<ModelInfo, 'connection_id' | 'fetched_at'>[],
): void {
  const db = getDb();
  const ts = now();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM models_cache WHERE connection_id = ?').run(connectionId);
    const stmt = db.prepare(
      `INSERT INTO models_cache (connection_id, model_id, display_name, context_length, metadata, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const m of models) {
      stmt.run(
        connectionId,
        m.model_id,
        m.display_name,
        m.context_length ?? null,
        JSON.stringify(m.metadata ?? {}),
        ts,
      );
    }
  });
  tx();
}

interface PrefRow {
  connection_id: string;
  model_id: string;
  alias: string | null;
  hidden: number;
  favorite: number;
}

export function getPickerModels(connectionNames: Map<string, string>): PickerModel[] {
  const db = getDb();
  const models = db.prepare('SELECT * FROM models_cache').all() as CacheRow[];
  const prefs = db.prepare('SELECT * FROM model_prefs').all() as PrefRow[];
  const recent = db.prepare('SELECT * FROM model_recent').all() as {
    connection_id: string;
    model_id: string;
    used_at: number;
  }[];
  const prefMap = new Map(prefs.map((p) => [`${p.connection_id}:${p.model_id}`, p]));
  const recentMap = new Map(recent.map((r) => [`${r.connection_id}:${r.model_id}`, r.used_at]));

  const result: (PickerModel & { _recent: number })[] = models.map((r) => {
    const key = `${r.connection_id}:${r.model_id}`;
    const pref = prefMap.get(key);
    const m = rowToModel(r);
    return {
      ...m,
      alias: pref?.alias ?? null,
      hidden: pref?.hidden === 1,
      favorite: pref?.favorite === 1,
      connection_name: connectionNames.get(r.connection_id) ?? r.connection_id,
      _recent: recentMap.get(key) ?? 0,
    };
  });

  result.sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    if (a._recent !== b._recent) return b._recent - a._recent;
    return a.display_name.localeCompare(b.display_name);
  });
  return result.map(({ _recent, ...rest }) => rest);
}

export function getConnectionModelsWithPrefs(
  connectionId: string,
  connectionName: string,
): PickerModel[] {
  const db = getDb();
  const models = getCachedModels(connectionId);
  const prefs = db
    .prepare('SELECT * FROM model_prefs WHERE connection_id = ?')
    .all(connectionId) as PrefRow[];
  const prefMap = new Map(prefs.map((p) => [p.model_id, p]));
  return models.map((m) => {
    const pref = prefMap.get(m.model_id);
    return {
      ...m,
      alias: pref?.alias ?? null,
      hidden: pref?.hidden === 1,
      favorite: pref?.favorite === 1,
      connection_name: connectionName,
    };
  });
}

export function setModelPref(
  connectionId: string,
  modelId: string,
  patch: { alias?: string | null; hidden?: boolean; favorite?: boolean },
): void {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM model_prefs WHERE connection_id = ? AND model_id = ?')
    .get(connectionId, modelId) as PrefRow | undefined;
  const merged = {
    alias: patch.alias !== undefined ? patch.alias : (existing?.alias ?? null),
    hidden: patch.hidden !== undefined ? (patch.hidden ? 1 : 0) : (existing?.hidden ?? 0),
    favorite: patch.favorite !== undefined ? (patch.favorite ? 1 : 0) : (existing?.favorite ?? 0),
  };
  db.prepare(
    `INSERT INTO model_prefs (connection_id, model_id, alias, hidden, favorite)
     VALUES (@c, @m, @alias, @hidden, @favorite)
     ON CONFLICT(connection_id, model_id) DO UPDATE SET alias=@alias, hidden=@hidden, favorite=@favorite`,
  ).run({ c: connectionId, m: modelId, ...merged });
}

export function markModelUsed(connectionId: string, modelId: string): void {
  getDb()
    .prepare(
      `INSERT INTO model_recent (connection_id, model_id, used_at) VALUES (?, ?, ?)
       ON CONFLICT(connection_id, model_id) DO UPDATE SET used_at = excluded.used_at`,
    )
    .run(connectionId, modelId, now());
}

export function getModelContextLength(connectionId: string, modelId: string): number | null {
  const row = getDb()
    .prepare('SELECT context_length FROM models_cache WHERE connection_id = ? AND model_id = ?')
    .get(connectionId, modelId) as { context_length: number | null } | undefined;
  return row?.context_length ?? null;
}
