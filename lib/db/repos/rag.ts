import 'server-only';
import { nanoid } from 'nanoid';
import { getDb, now, hasVec } from '../index';
import type { Chunk, DocumentRow } from '../../types';

export function listDocuments(chatId: string): DocumentRow[] {
  return getDb()
    .prepare('SELECT * FROM documents WHERE chat_id = ? ORDER BY indexed_at DESC')
    .all(chatId) as DocumentRow[];
}

export function createDocument(chatId: string | null, filename: string, content: string): DocumentRow {
  const id = nanoid();
  getDb()
    .prepare('INSERT INTO documents (id, chat_id, filename, content, indexed_at) VALUES (?, ?, ?, ?, NULL)')
    .run(id, chatId, filename, content);
  return getDb().prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRow;
}

export function markDocumentIndexed(id: string): void {
  getDb().prepare('UPDATE documents SET indexed_at = ? WHERE id = ?').run(now(), id);
}

export function deleteDocument(id: string): void {
  const chunkIds = getDb().prepare('SELECT id FROM chunks WHERE document_id = ?').all(id) as {
    id: string;
  }[];
  if (hasVec()) {
    for (const c of chunkIds) getDb().prepare('DELETE FROM vec_chunks WHERE chunk_id = ?').run(c.id);
  }
  getDb().prepare('DELETE FROM documents WHERE id = ?').run(id);
}

function toBlob(vec: number[]): Buffer {
  return Buffer.from(new Float32Array(vec).buffer);
}

function fromBlob(buf: Buffer): number[] {
  return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
}

export function insertChunk(
  documentId: string,
  content: string,
  embedding: number[],
  tokenCount: number,
): string {
  const id = nanoid();
  getDb()
    .prepare('INSERT INTO chunks (id, document_id, content, embedding, token_count) VALUES (?, ?, ?, ?, ?)')
    .run(id, documentId, content, toBlob(embedding), tokenCount);
  if (hasVec()) {
    try {
      getDb()
        .prepare('INSERT INTO vec_chunks (chunk_id, embedding) VALUES (?, ?)')
        .run(id, JSON.stringify(embedding));
    } catch {
      /* vec insert best-effort */
    }
  }
  return id;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface RetrievedChunk extends Chunk {
  score: number;
}

export function retrieve(
  chatId: string,
  queryEmbedding: number[],
  topK: number,
  threshold: number,
): RetrievedChunk[] {
  const db = getDb();
  const docIds = db.prepare('SELECT id FROM documents WHERE chat_id = ?').all(chatId) as {
    id: string;
  }[];
  if (docIds.length === 0) return [];
  const placeholders = docIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT id, document_id, content, embedding, token_count FROM chunks WHERE document_id IN (${placeholders})`,
    )
    .all(...docIds.map((d) => d.id)) as {
    id: string;
    document_id: string;
    content: string;
    embedding: Buffer;
    token_count: number;
  }[];

  const scored = rows
    .map((r) => ({
      id: r.id,
      document_id: r.document_id,
      content: r.content,
      token_count: r.token_count,
      score: cosine(queryEmbedding, fromBlob(r.embedding)),
    }))
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return scored;
}
