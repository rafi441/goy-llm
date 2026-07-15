import 'server-only';
import { nanoid } from 'nanoid';
import { getDb, now } from '../index';
import type { AuthorNotePosition, Chat, GenConfig } from '../../types';

interface ChatRow {
  id: string;
  character_id: string | null;
  persona_id: string | null;
  title: string | null;
  connection_id: string | null;
  model_id: string | null;
  gen_config: string | null;
  author_note: string | null;
  author_note_position: string | null;
  author_note_depth: number;
  author_note_enabled: number;
  rag_enabled: number;
  pinned: number;
  archived: number;
  deleted_at: number | null;
  parent_chat_id: string | null;
  branch_from_message_id: string | null;
  created_at: number;
  updated_at: number;
}

function rowToChat(r: ChatRow): Chat {
  let gen: GenConfig | null = null;
  if (r.gen_config) {
    try {
      gen = JSON.parse(r.gen_config) as GenConfig;
    } catch {
      gen = null;
    }
  }
  return {
    id: r.id,
    character_id: r.character_id,
    persona_id: r.persona_id,
    title: r.title ?? 'New Chat',
    connection_id: r.connection_id,
    model_id: r.model_id,
    gen_config: gen,
    author_note: r.author_note ?? '',
    author_note_position: (r.author_note_position as AuthorNotePosition) ?? 'depth',
    author_note_depth: r.author_note_depth,
    author_note_enabled: r.author_note_enabled,
    rag_enabled: r.rag_enabled,
    pinned: r.pinned,
    archived: r.archived,
    deleted_at: r.deleted_at,
    parent_chat_id: r.parent_chat_id,
    branch_from_message_id: r.branch_from_message_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export interface ChatListItem {
  id: string;
  title: string;
  pinned: number;
  archived: number;
  updated_at: number;
  character_id: string | null;
  character_name: string | null;
  avatar_path: string | null;
}

export function listChats(includeArchived = false): ChatListItem[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.title, c.pinned, c.archived, c.updated_at, c.character_id,
        ch.name AS character_name, ch.avatar_path
       FROM chats c LEFT JOIN characters ch ON ch.id = c.character_id
       WHERE c.deleted_at IS NULL ${includeArchived ? '' : 'AND c.archived = 0'}
       ORDER BY c.pinned DESC, c.updated_at DESC`,
    )
    .all() as (ChatListItem & { title: string | null })[];
  return rows.map((r) => ({ ...r, title: r.title ?? 'New Chat' }));
}

export function getChat(id: string): Chat | undefined {
  const r = getDb().prepare('SELECT * FROM chats WHERE id = ?').get(id) as ChatRow | undefined;
  return r ? rowToChat(r) : undefined;
}

export interface ChatInput {
  character_id?: string | null;
  persona_id?: string | null;
  title?: string;
  connection_id?: string | null;
  model_id?: string | null;
  gen_config?: GenConfig | null;
}

export function createChat(input: ChatInput): Chat {
  const id = nanoid();
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO chats (id, character_id, persona_id, title, connection_id, model_id, gen_config,
        author_note, author_note_position, author_note_depth, author_note_enabled, rag_enabled,
        pinned, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', 'depth', 4, 1, 0, 0, 0, ?, ?)`,
    )
    .run(
      id,
      input.character_id ?? null,
      input.persona_id ?? null,
      input.title ?? 'New Chat',
      input.connection_id ?? null,
      input.model_id ?? null,
      input.gen_config ? JSON.stringify(input.gen_config) : null,
      ts,
      ts,
    );
  return getChat(id)!;
}

export type ChatPatch = Partial<
  Pick<
    Chat,
    | 'character_id'
    | 'persona_id'
    | 'title'
    | 'connection_id'
    | 'model_id'
    | 'author_note'
    | 'author_note_position'
    | 'author_note_depth'
  >
> & {
  gen_config?: GenConfig | null;
  author_note_enabled?: boolean;
  rag_enabled?: boolean;
  pinned?: boolean;
  archived?: boolean;
};

export function updateChat(id: string, patch: ChatPatch): Chat | undefined {
  const c = getChat(id);
  if (!c) return undefined;
  getDb()
    .prepare(
      `UPDATE chats SET character_id=@character_id, persona_id=@persona_id, title=@title,
        connection_id=@connection_id, model_id=@model_id, gen_config=@gen_config,
        author_note=@author_note, author_note_position=@author_note_position, author_note_depth=@author_note_depth,
        author_note_enabled=@author_note_enabled, rag_enabled=@rag_enabled,
        pinned=@pinned, archived=@archived, updated_at=@ts WHERE id=@id`,
    )
    .run({
      id,
      character_id: patch.character_id !== undefined ? patch.character_id : c.character_id,
      persona_id: patch.persona_id !== undefined ? patch.persona_id : c.persona_id,
      title: patch.title ?? c.title,
      connection_id: patch.connection_id !== undefined ? patch.connection_id : c.connection_id,
      model_id: patch.model_id !== undefined ? patch.model_id : c.model_id,
      gen_config:
        patch.gen_config !== undefined
          ? patch.gen_config
            ? JSON.stringify(patch.gen_config)
            : null
          : c.gen_config
            ? JSON.stringify(c.gen_config)
            : null,
      author_note: patch.author_note !== undefined ? patch.author_note : c.author_note,
      author_note_position: patch.author_note_position ?? c.author_note_position,
      author_note_depth: patch.author_note_depth ?? c.author_note_depth,
      author_note_enabled:
        patch.author_note_enabled === undefined
          ? c.author_note_enabled
          : patch.author_note_enabled
            ? 1
            : 0,
      rag_enabled: patch.rag_enabled === undefined ? c.rag_enabled : patch.rag_enabled ? 1 : 0,
      pinned: patch.pinned === undefined ? c.pinned : patch.pinned ? 1 : 0,
      archived: patch.archived === undefined ? c.archived : patch.archived ? 1 : 0,
      ts: now(),
    });
  return getChat(id);
}

export function softDeleteChat(id: string): void {
  getDb().prepare('UPDATE chats SET deleted_at = ? WHERE id = ?').run(now(), id);
}

export function restoreChat(id: string): void {
  getDb().prepare('UPDATE chats SET deleted_at = NULL WHERE id = ?').run(id);
}

export function listTrash(): ChatListItem[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.title, c.pinned, c.archived, c.updated_at, c.character_id,
        ch.name AS character_name, ch.avatar_path
       FROM chats c LEFT JOIN characters ch ON ch.id = c.character_id
       WHERE c.deleted_at IS NOT NULL ORDER BY c.deleted_at DESC`,
    )
    .all() as (ChatListItem & { title: string | null })[];
  return rows.map((r) => ({ ...r, title: r.title ?? 'New Chat' }));
}

export function purgeExpiredTrash(retentionDays = 30): void {
  const cutoff = now() - retentionDays * 24 * 60 * 60 * 1000;
  getDb().prepare('DELETE FROM chats WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(cutoff);
}

export function hardDeleteChat(id: string): void {
  getDb().prepare('DELETE FROM chats WHERE id = ?').run(id);
}

export function reassignModel(oldConnectionId: string, connectionId: string, modelId: string): void {
  getDb()
    .prepare('UPDATE chats SET connection_id = ?, model_id = ? WHERE connection_id = ?')
    .run(connectionId, modelId, oldConnectionId);
}

export function branchChat(sourceId: string, fromMessageId: string): Chat | undefined {
  const src = getChat(sourceId);
  if (!src) return undefined;
  const db = getDb();
  const cutoff = db
    .prepare('SELECT created_at, rowid FROM messages WHERE id = ?')
    .get(fromMessageId) as { created_at: number; rowid: number } | undefined;
  if (!cutoff) return undefined;

  const clone = createChat({
    character_id: src.character_id,
    persona_id: src.persona_id,
    title: `${src.title} (branch)`,
    connection_id: src.connection_id,
    model_id: src.model_id,
    gen_config: src.gen_config,
  });

  updateChat(clone.id, {
    author_note: src.author_note,
    author_note_position: src.author_note_position,
    author_note_depth: src.author_note_depth,
    author_note_enabled: src.author_note_enabled === 1,
    rag_enabled: src.rag_enabled === 1,
  });

  db.prepare('UPDATE chats SET parent_chat_id = ?, branch_from_message_id = ? WHERE id = ?').run(
    sourceId,
    fromMessageId,
    clone.id,
  );

  const rows = db
    .prepare(
      `SELECT * FROM messages WHERE chat_id = ? AND (created_at < ? OR (created_at = ? AND rowid <= ?)) ORDER BY created_at ASC, rowid ASC`,
    )
    .all(sourceId, cutoff.created_at, cutoff.created_at, cutoff.rowid) as {
    id: string;
    role: string;
    type: string;
    mode: string | null;
    swipes: string;
    swipe_index: number;
    pinned_directive: number;
    token_count: number | null;
    created_at: number;
  }[];

  const insert = db.prepare(
    `INSERT INTO messages (id, chat_id, role, type, mode, swipes, swipe_index, pinned_directive, token_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const ftsInsert = db.prepare(
    'INSERT INTO messages_fts (message_id, chat_id, content) VALUES (?, ?, ?)',
  );
  const tx = db.transaction(() => {
    for (const r of rows) {
      const newId = nanoid();
      insert.run(
        newId,
        clone.id,
        r.role,
        r.type,
        r.mode,
        r.swipes,
        r.swipe_index,
        r.pinned_directive,
        r.token_count,
        r.created_at,
        r.created_at,
      );
      let content = '';
      try {
        const arr = JSON.parse(r.swipes) as string[];
        content = arr[r.swipe_index] ?? arr[0] ?? '';
      } catch {
        content = r.swipes;
      }
      if (content.trim()) ftsInsert.run(newId, clone.id, content);
    }
  });
  tx();
  return getChat(clone.id);
}
