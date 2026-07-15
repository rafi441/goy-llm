import 'server-only';
import { nanoid } from 'nanoid';
import { getDb, now } from '../index';
import { estimateTokens } from '../../tokenizer';
import type { Message, MessageRole, MessageType, PlayMode } from '../../types';

interface MsgRow {
  id: string;
  chat_id: string;
  role: string;
  type: string;
  mode: string | null;
  swipes: string;
  swipe_index: number;
  pinned_directive: number;
  token_count: number | null;
  created_at: number;
  updated_at: number;
}

function parseSwipes(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [String(raw)];
  } catch {
    return [raw];
  }
}

function rowToMsg(r: MsgRow): Message {
  return {
    id: r.id,
    chat_id: r.chat_id,
    role: r.role as MessageRole,
    type: r.type as MessageType,
    mode: (r.mode as PlayMode | null) ?? null,
    swipes: parseSwipes(r.swipes),
    swipe_index: r.swipe_index,
    pinned_directive: r.pinned_directive,
    token_count: r.token_count,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function currentContent(m: Message): string {
  return m.swipes[m.swipe_index] ?? m.swipes[0] ?? '';
}

function syncFts(messageId: string, chatId: string, content: string): void {
  const db = getDb();
  db.prepare('DELETE FROM messages_fts WHERE message_id = ?').run(messageId);
  if (content.trim()) {
    db.prepare('INSERT INTO messages_fts (message_id, chat_id, content) VALUES (?, ?, ?)').run(
      messageId,
      chatId,
      content,
    );
  }
}

export function listMessages(chatId: string): Message[] {
  const rows = getDb()
    .prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC, rowid ASC')
    .all(chatId) as MsgRow[];
  return rows.map(rowToMsg);
}

export function getMessage(id: string): Message | undefined {
  const r = getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id) as MsgRow | undefined;
  return r ? rowToMsg(r) : undefined;
}

export interface MessageInput {
  chat_id: string;
  role: MessageRole;
  type?: MessageType;
  mode?: PlayMode | null;
  swipes: string[];
  swipe_index?: number;
  pinned_directive?: boolean;
  created_at?: number;
}

export function createMessage(input: MessageInput): Message {
  const id = nanoid();
  const ts = input.created_at ?? now();
  const idx = input.swipe_index ?? 0;
  const content = input.swipes[idx] ?? '';
  getDb()
    .prepare(
      `INSERT INTO messages (id, chat_id, role, type, mode, swipes, swipe_index, pinned_directive, token_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.chat_id,
      input.role,
      input.type ?? 'chat',
      input.mode ?? null,
      JSON.stringify(input.swipes),
      idx,
      input.pinned_directive ? 1 : 0,
      estimateTokens(content),
      ts,
      ts,
    );
  syncFts(id, input.chat_id, content);
  touchChat(input.chat_id);
  return getMessage(id)!;
}

export interface MessagePatch {
  swipes?: string[];
  swipe_index?: number;
  mode?: PlayMode | null;
  pinned_directive?: boolean;
}

export function updateMessage(id: string, patch: MessagePatch): Message | undefined {
  const existing = getMessage(id);
  if (!existing) return undefined;
  const swipes = patch.swipes ?? existing.swipes;
  const idx = patch.swipe_index !== undefined ? patch.swipe_index : existing.swipe_index;
  const clampedIdx = Math.max(0, Math.min(idx, swipes.length - 1));
  const content = swipes[clampedIdx] ?? '';
  getDb()
    .prepare(
      `UPDATE messages SET swipes=?, swipe_index=?, mode=?, pinned_directive=?, token_count=?, updated_at=? WHERE id=?`,
    )
    .run(
      JSON.stringify(swipes),
      clampedIdx,
      patch.mode !== undefined ? patch.mode : existing.mode,
      patch.pinned_directive !== undefined
        ? patch.pinned_directive
          ? 1
          : 0
        : existing.pinned_directive,
      estimateTokens(content),
      now(),
      id,
    );
  syncFts(id, existing.chat_id, content);
  touchChat(existing.chat_id);
  return getMessage(id);
}

export function appendSwipe(id: string, content: string): Message | undefined {
  const existing = getMessage(id);
  if (!existing) return undefined;
  const swipes = [...existing.swipes, content];
  return updateMessage(id, { swipes, swipe_index: swipes.length - 1 });
}

export function deleteMessage(id: string): void {
  const m = getMessage(id);
  if (!m) return;
  getDb().prepare('DELETE FROM messages_fts WHERE message_id = ?').run(id);
  getDb().prepare('DELETE FROM messages WHERE id = ?').run(id);
  touchChat(m.chat_id);
}

export function deleteFromHere(id: string): number {
  const m = getMessage(id);
  if (!m) return 0;
  const rows = getDb()
    .prepare('SELECT id FROM messages WHERE chat_id = ? AND created_at >= ?')
    .all(m.chat_id, m.created_at) as { id: string }[];
  const db = getDb();
  const tx = db.transaction(() => {
    for (const r of rows) {
      db.prepare('DELETE FROM messages_fts WHERE message_id = ?').run(r.id);
      db.prepare('DELETE FROM messages WHERE id = ?').run(r.id);
    }
  });
  tx();
  touchChat(m.chat_id);
  return rows.length;
}

export function lastAssistantMessage(chatId: string): Message | undefined {
  const r = getDb()
    .prepare(
      "SELECT * FROM messages WHERE chat_id = ? AND role = 'assistant' AND type != 'directive' ORDER BY created_at DESC, rowid DESC LIMIT 1",
    )
    .get(chatId) as MsgRow | undefined;
  return r ? rowToMsg(r) : undefined;
}

export function touchChat(chatId: string): void {
  getDb().prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(now(), chatId);
}

export interface SearchHit {
  message_id: string;
  chat_id: string;
  snippet: string;
}

export function searchMessages(query: string, limit = 30): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const match = q
    .split(/\s+/)
    .map((t) => `"${t.replace(/"/g, '')}"*`)
    .join(' ');
  try {
    return getDb()
      .prepare(
        `SELECT message_id, chat_id, snippet(messages_fts, 2, '[', ']', '…', 12) AS snippet
         FROM messages_fts WHERE content MATCH ? ORDER BY rank LIMIT ?`,
      )
      .all(match, limit) as SearchHit[];
  } catch {
    return [];
  }
}
