import 'server-only';
import { estimateTokens } from '../tokenizer';
import { getConnection, getDecryptedKey } from '../db/repos/connections';
import { getBehavior } from '../db/repos/settings';
import { createDocument, insertChunk, markDocumentIndexed } from '../db/repos/rag';
import { getProvider } from '../providers';

const CHUNK_TOKENS = 512;
const OVERLAP_TOKENS = 64;

export function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current.join('\n\n'));
    const overlap: string[] = [];
    let overlapTokens = 0;
    for (let i = current.length - 1; i >= 0; i--) {
      const t = estimateTokens(current[i]!);
      if (overlapTokens + t > OVERLAP_TOKENS) break;
      overlap.unshift(current[i]!);
      overlapTokens += t;
    }
    current = overlap;
    currentTokens = overlapTokens;
  };

  for (const para of paragraphs) {
    const t = estimateTokens(para);
    if (t > CHUNK_TOKENS) {
      flush();
      const sentences = para.split(/(?<=[.!?])\s+/);
      let sub: string[] = [];
      let subTokens = 0;
      for (const s of sentences) {
        const st = estimateTokens(s);
        if (subTokens + st > CHUNK_TOKENS && sub.length) {
          chunks.push(sub.join(' '));
          sub = [];
          subTokens = 0;
        }
        sub.push(s);
        subTokens += st;
      }
      if (sub.length) chunks.push(sub.join(' '));
      continue;
    }
    if (currentTokens + t > CHUNK_TOKENS && current.length) flush();
    current.push(para);
    currentTokens += t;
  }
  flush();
  return chunks.filter((c) => c.trim().length > 0);
}

export function extractText(filename: string, buffer: Buffer): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) {
    const raw = buffer.toString('latin1');
    const matches = raw.match(/\(([^()\\]{2,})\)/g) ?? [];
    const text = matches.map((m) => m.slice(1, -1)).join(' ');
    return text || buffer.toString('utf8');
  }
  return buffer.toString('utf8');
}

export interface IndexProgress {
  stage: 'chunking' | 'embedding' | 'done' | 'error';
  total: number;
  completed: number;
  documentId?: string;
  message?: string;
}

export async function* indexDocument(
  chatId: string | null,
  filename: string,
  content: string,
): AsyncGenerator<IndexProgress> {
  const behavior = getBehavior();
  if (!behavior.embedding_connection_id || !behavior.embedding_model_id) {
    yield { stage: 'error', total: 0, completed: 0, message: 'Embedding provider not configured' };
    return;
  }
  const conn = getConnection(behavior.embedding_connection_id);
  if (!conn) {
    yield { stage: 'error', total: 0, completed: 0, message: 'Embedding connection not found' };
    return;
  }
  const provider = getProvider(conn.type, conn.base_url, getDecryptedKey(conn.id));

  const doc = createDocument(chatId, filename, content);
  const chunks = chunkText(content);
  yield { stage: 'chunking', total: chunks.length, completed: 0, documentId: doc.id };

  const BATCH = 16;
  let completed = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    let embeddings: number[][];
    try {
      embeddings = await provider.embed(batch, behavior.embedding_model_id);
    } catch (e) {
      yield {
        stage: 'error',
        total: chunks.length,
        completed,
        documentId: doc.id,
        message: e instanceof Error ? e.message : 'Embedding failed',
      };
      return;
    }
    for (let j = 0; j < batch.length; j++) {
      const emb = embeddings[j];
      if (emb) insertChunk(doc.id, batch[j]!, emb, estimateTokens(batch[j]!));
      completed += 1;
    }
    yield { stage: 'embedding', total: chunks.length, completed, documentId: doc.id };
  }

  markDocumentIndexed(doc.id);
  yield { stage: 'done', total: chunks.length, completed, documentId: doc.id };
}
