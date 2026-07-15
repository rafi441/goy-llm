export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  type TEXT NOT NULL,
  base_url TEXT,
  api_key_encrypted TEXT,
  oob_mode TEXT DEFAULT 'system',
  enabled INTEGER DEFAULT 1,
  created_at INTEGER, updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS models_cache (
  connection_id TEXT, model_id TEXT, display_name TEXT,
  context_length INTEGER, metadata TEXT, fetched_at INTEGER,
  PRIMARY KEY (connection_id, model_id),
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS model_prefs (
  connection_id TEXT, model_id TEXT,
  alias TEXT, hidden INTEGER DEFAULT 0, favorite INTEGER DEFAULT 0,
  PRIMARY KEY (connection_id, model_id)
);

CREATE TABLE IF NOT EXISTS model_recent (
  connection_id TEXT, model_id TEXT, used_at INTEGER,
  PRIMARY KEY (connection_id, model_id)
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar_path TEXT,
  spec TEXT NOT NULL DEFAULT 'chara_card_v3',
  description TEXT, personality TEXT, scenario TEXT,
  first_mes TEXT, mes_example TEXT, creator_notes TEXT,
  system_prompt TEXT, post_history_instructions TEXT,
  alternate_greetings TEXT, tags TEXT,
  creator TEXT, character_version TEXT,
  character_book TEXT,
  extensions TEXT,
  created_at INTEGER, updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar_path TEXT,
  description TEXT, is_default INTEGER DEFAULT 0, created_at INTEGER
);

CREATE TABLE IF NOT EXISTS presets (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  config TEXT NOT NULL,
  is_default INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY, character_id TEXT, persona_id TEXT, title TEXT,
  connection_id TEXT, model_id TEXT, gen_config TEXT,
  author_note TEXT, author_note_position TEXT DEFAULT 'depth',
  author_note_depth INTEGER DEFAULT 4, author_note_enabled INTEGER DEFAULT 1,
  rag_enabled INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0, archived INTEGER DEFAULT 0, deleted_at INTEGER,
  parent_chat_id TEXT, branch_from_message_id TEXT,
  created_at INTEGER, updated_at INTEGER,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, chat_id TEXT NOT NULL,
  role TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'chat',
  mode TEXT,
  swipes TEXT NOT NULL,
  swipe_index INTEGER DEFAULT 0,
  pinned_directive INTEGER DEFAULT 0,
  token_count INTEGER, created_at INTEGER, updated_at INTEGER,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);

CREATE TABLE IF NOT EXISTS lorebooks (
  id TEXT PRIMARY KEY, name TEXT, scope TEXT, character_id TEXT
);
CREATE TABLE IF NOT EXISTS lorebook_entries (
  id TEXT PRIMARY KEY, lorebook_id TEXT NOT NULL,
  keys TEXT, secondary_keys TEXT, content TEXT,
  insertion_order INTEGER DEFAULT 100, position TEXT DEFAULT 'before_char',
  enabled INTEGER DEFAULT 1, constant INTEGER DEFAULT 0,
  selective INTEGER DEFAULT 0, case_sensitive INTEGER DEFAULT 0,
  scan_depth INTEGER DEFAULT 4,
  FOREIGN KEY (lorebook_id) REFERENCES lorebooks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, chat_id TEXT, filename TEXT, content TEXT, indexed_at INTEGER
);
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY, document_id TEXT, content TEXT,
  embedding BLOB, token_count INTEGER,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  message_id UNINDEXED, chat_id UNINDEXED, content
);
`;
