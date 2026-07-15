import 'server-only';
import { nanoid } from 'nanoid';
import { getDb, now } from '../index';
import { encrypt, decrypt, maskKey } from '../../crypto';
import type { Connection, MaskedConnection, OobMode, ProviderType } from '../../types';

function toMasked(c: Connection): MaskedConnection {
  let masked: string | null = null;
  if (c.api_key_encrypted) {
    try {
      masked = maskKey(decrypt(c.api_key_encrypted));
    } catch {
      masked = 'sk-••••••';
    }
  }
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    base_url: c.base_url,
    api_key_masked: masked,
    has_key: !!c.api_key_encrypted,
    oob_mode: c.oob_mode,
    enabled: c.enabled,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

export function listConnections(): Connection[] {
  return getDb().prepare('SELECT * FROM connections ORDER BY created_at ASC').all() as Connection[];
}

export function listMaskedConnections(): MaskedConnection[] {
  return listConnections().map(toMasked);
}

export function getConnection(id: string): Connection | undefined {
  return getDb().prepare('SELECT * FROM connections WHERE id = ?').get(id) as Connection | undefined;
}

export function getMaskedConnection(id: string): MaskedConnection | undefined {
  const c = getConnection(id);
  return c ? toMasked(c) : undefined;
}

export function getDecryptedKey(id: string): string | null {
  const c = getConnection(id);
  if (!c?.api_key_encrypted) return null;
  try {
    return decrypt(c.api_key_encrypted);
  } catch {
    return null;
  }
}

export interface ConnectionInput {
  name: string;
  type: ProviderType;
  base_url?: string | null;
  api_key?: string | null;
  oob_mode?: OobMode;
  enabled?: boolean;
}

export function createConnection(input: ConnectionInput): MaskedConnection {
  const id = nanoid();
  const ts = now();
  const enc = input.api_key ? encrypt(input.api_key) : null;
  getDb()
    .prepare(
      `INSERT INTO connections (id, name, type, base_url, api_key_encrypted, oob_mode, enabled, created_at, updated_at)
       VALUES (@id, @name, @type, @base_url, @enc, @oob_mode, @enabled, @ts, @ts)`,
    )
    .run({
      id,
      name: input.name,
      type: input.type,
      base_url: input.base_url ?? null,
      enc,
      oob_mode: input.oob_mode ?? 'system',
      enabled: input.enabled === false ? 0 : 1,
      ts,
    });
  return getMaskedConnection(id)!;
}

export interface ConnectionPatch {
  name?: string;
  type?: ProviderType;
  base_url?: string | null;
  api_key?: string | null;
  oob_mode?: OobMode;
  enabled?: boolean;
}

export function updateConnection(id: string, patch: ConnectionPatch): MaskedConnection | undefined {
  const existing = getConnection(id);
  if (!existing) return undefined;

  const baseUrlChanged = patch.base_url !== undefined && patch.base_url !== existing.base_url;
  const typeChanged = patch.type !== undefined && patch.type !== existing.type;

  let enc = existing.api_key_encrypted;
  if (patch.api_key !== undefined && patch.api_key !== null && patch.api_key !== '') {
    enc = encrypt(patch.api_key);
  } else if (patch.api_key === null) {
    enc = null;
  }

  getDb()
    .prepare(
      `UPDATE connections SET name=@name, type=@type, base_url=@base_url,
       api_key_encrypted=@enc, oob_mode=@oob_mode, enabled=@enabled, updated_at=@ts WHERE id=@id`,
    )
    .run({
      id,
      name: patch.name ?? existing.name,
      type: patch.type ?? existing.type,
      base_url: patch.base_url !== undefined ? patch.base_url : existing.base_url,
      enc,
      oob_mode: patch.oob_mode ?? existing.oob_mode,
      enabled: patch.enabled === undefined ? existing.enabled : patch.enabled ? 1 : 0,
      ts: now(),
    });

  if (baseUrlChanged || typeChanged) {
    getDb().prepare('DELETE FROM models_cache WHERE connection_id = ?').run(id);
  }
  return getMaskedConnection(id);
}

export function countChatsUsingConnection(id: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS n FROM chats WHERE connection_id = ? AND deleted_at IS NULL')
    .get(id) as { n: number };
  return row.n;
}

export function deleteConnection(id: string): void {
  getDb().prepare('DELETE FROM connections WHERE id = ?').run(id);
}
