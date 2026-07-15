export type ProviderType = 'openrouter' | 'ollama' | 'lmstudio' | 'openai_compat';
export type OobMode = 'system' | 'user_prefix';
export type PlayMode = 'as_user' | 'as_char' | 'narrator';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageType = 'chat' | 'directive' | 'narration';
export type AuthorNotePosition = 'system' | 'depth' | 'after';
export type CardSpec = 'chara_card_v2' | 'chara_card_v3';
export type ExportFormat = 'png' | 'json_v2' | 'json_v3';

export interface Connection {
  id: string;
  name: string;
  type: ProviderType;
  base_url: string | null;
  api_key_encrypted: string | null;
  oob_mode: OobMode;
  enabled: number;
  created_at: number;
  updated_at: number;
}

export interface MaskedConnection {
  id: string;
  name: string;
  type: ProviderType;
  base_url: string | null;
  api_key_masked: string | null;
  has_key: boolean;
  oob_mode: OobMode;
  enabled: number;
  created_at: number;
  updated_at: number;
}

export interface ModelInfo {
  connection_id: string;
  model_id: string;
  display_name: string;
  context_length: number | null;
  metadata: ModelMetadata;
  fetched_at: number;
}

export interface ModelMetadata {
  prompt_price?: number | null;
  completion_price?: number | null;
  description?: string | null;
  [key: string]: unknown;
}

export interface ModelPref {
  connection_id: string;
  model_id: string;
  alias: string | null;
  hidden: number;
  favorite: number;
}

export interface PickerModel extends ModelInfo {
  alias: string | null;
  hidden: boolean;
  favorite: boolean;
  connection_name: string;
}

export interface CharacterBookEntry {
  keys: string[];
  secondary_keys?: string[];
  content: string;
  insertion_order?: number;
  enabled?: boolean;
  constant?: boolean;
  selective?: boolean;
  case_sensitive?: boolean;
  scan_depth?: number;
  position?: string;
  comment?: string;
  name?: string;
  id?: number | string;
  extensions?: Record<string, unknown>;
}

export interface CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  entries: CharacterBookEntry[];
  extensions?: Record<string, unknown>;
}

export interface Character {
  id: string;
  name: string;
  avatar_path: string | null;
  spec: CardSpec;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  tags: string[];
  creator: string;
  character_version: string;
  character_book: CharacterBook | null;
  extensions: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface Persona {
  id: string;
  name: string;
  avatar_path: string | null;
  description: string;
  is_default: number;
  created_at: number;
}

export interface GenConfig {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  min_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  max_tokens?: number;
  seed?: number | null;
  stop_sequences?: string[];
}

export interface Preset {
  id: string;
  name: string;
  config: GenConfig;
  is_default: number;
}

export interface Chat {
  id: string;
  character_id: string | null;
  persona_id: string | null;
  title: string;
  connection_id: string | null;
  model_id: string | null;
  gen_config: GenConfig | null;
  author_note: string;
  author_note_position: AuthorNotePosition;
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

export interface Message {
  id: string;
  chat_id: string;
  role: MessageRole;
  type: MessageType;
  mode: PlayMode | null;
  swipes: string[];
  swipe_index: number;
  pinned_directive: number;
  token_count: number | null;
  created_at: number;
  updated_at: number;
}

export interface Lorebook {
  id: string;
  name: string;
  scope: 'global' | 'character';
  character_id: string | null;
}

export interface LorebookEntry {
  id: string;
  lorebook_id: string;
  keys: string[];
  secondary_keys: string[];
  content: string;
  insertion_order: number;
  position: string;
  enabled: number;
  constant: number;
  selective: number;
  case_sensitive: number;
  scan_depth: number;
}

export interface DocumentRow {
  id: string;
  chat_id: string | null;
  filename: string;
  content: string;
  indexed_at: number | null;
}

export interface Chunk {
  id: string;
  document_id: string;
  content: string;
  token_count: number;
}

export interface ProviderMessage {
  role: MessageRole;
  content: string;
  name?: string;
}

export interface PromptBlock {
  label: string;
  role: MessageRole;
  content: string;
  tokens: number;
  ephemeral?: boolean;
}

export interface BuiltPrompt {
  messages: ProviderMessage[];
  blocks: PromptBlock[];
  totalTokens: number;
  budget: number;
  truncatedAt: string | null;
  activeLorebookEntries: { id: string; keys: string[]; tokens: number }[];
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

export interface Capabilities {
  supports: Record<keyof GenConfig, boolean>;
  streaming: boolean;
  embeddings: boolean;
}

export const PROMPT_ORDER_KEYS = [
  'system_prompt',
  'character',
  'persona',
  'author_note_system',
  'lorebook',
  'rag',
  'example_messages',
  'chat_history',
  'author_note_depth',
  'post_history',
  'director',
] as const;

export type PromptOrderKey = (typeof PROMPT_ORDER_KEYS)[number];
