import 'server-only';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { createRequire } from 'node:module';
import { SCHEMA } from './schema';

const nodeRequire = createRequire(import.meta.url);

type DB = Database.Database;

interface DbGlobal {
  db?: DB;
  vecLoaded?: boolean;
}

const g = globalThis as unknown as { __goyllm?: DbGlobal };
if (!g.__goyllm) g.__goyllm = {};

export function dataDir(): string {
  const raw = process.env.GOYLLM_DATA_DIR || './data';
  return isAbsolute(raw) ? raw : join(process.cwd(), raw);
}

export function avatarsDir(): string {
  return join(dataDir(), 'avatars');
}

function init(): DB {
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  mkdirSync(avatarsDir(), { recursive: true });

  const db = new Database(join(dir, 'goyllm.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  try {
    const sqliteVec = nodeRequire('sqlite-vec') as { load: (d: DB) => void };
    sqliteVec.load(db);
    db.exec(
      "CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(chunk_id TEXT PRIMARY KEY, embedding FLOAT[768] distance_metric=cosine)",
    );
    g.__goyllm!.vecLoaded = true;
  } catch {
    g.__goyllm!.vecLoaded = false;
  }

  db.exec(SCHEMA);
  return db;
}

export function getDb(): DB {
  if (!g.__goyllm!.db) {
    g.__goyllm!.db = init();
  }
  return g.__goyllm!.db!;
}

export function hasVec(): boolean {
  getDb();
  return g.__goyllm!.vecLoaded === true;
}

export function now(): number {
  return Date.now();
}

export function dbPath(): string {
  return join(dataDir(), 'goyllm.db');
}

export function backupBuffer(): Buffer {
  const db = getDb();
  db.pragma('wal_checkpoint(TRUNCATE)');
  const fs = nodeRequire('node:fs') as typeof import('node:fs');
  return fs.readFileSync(dbPath());
}

export function restoreFromBuffer(buf: Buffer): void {
  const fs = nodeRequire('node:fs') as typeof import('node:fs');
  if (g.__goyllm!.db) {
    g.__goyllm!.db.close();
    g.__goyllm!.db = undefined;
  }
  const p = dbPath();
  fs.writeFileSync(p, buf);
  for (const suffix of ['-wal', '-shm']) {
    try {
      fs.unlinkSync(p + suffix);
    } catch {
      /* not present */
    }
  }
  getDb();
}
