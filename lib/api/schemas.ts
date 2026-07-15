import { z } from 'zod';

export const providerTypeSchema = z.enum(['openrouter', 'ollama', 'lmstudio', 'openai_compat']);
export const oobModeSchema = z.enum(['system', 'user_prefix']);
export const playModeSchema = z.enum(['as_user', 'as_char', 'narrator']);
export const authorNotePositionSchema = z.enum(['system', 'depth', 'after']);

export const genConfigSchema = z
  .object({
    temperature: z.number().min(0).max(5).optional(),
    top_p: z.number().min(0).max(1).optional(),
    top_k: z.number().int().min(0).optional(),
    min_p: z.number().min(0).max(1).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    repetition_penalty: z.number().min(0).max(5).optional(),
    max_tokens: z.number().int().min(1).max(131072).optional(),
    seed: z.number().int().nullable().optional(),
    stop_sequences: z.array(z.string()).optional(),
  })
  .strict();

export const connectionCreateSchema = z.object({
  name: z.string().min(1),
  type: providerTypeSchema,
  base_url: z.string().nullable().optional(),
  api_key: z.string().nullable().optional(),
  oob_mode: oobModeSchema.optional(),
  enabled: z.boolean().optional(),
});

export const connectionPatchSchema = connectionCreateSchema.partial();

export const modelPrefSchema = z.object({
  model_id: z.string().min(1),
  alias: z.string().nullable().optional(),
  hidden: z.boolean().optional(),
  favorite: z.boolean().optional(),
});

const stringArray = z.array(z.string());

export const characterSchema = z.object({
  name: z.string().min(1),
  avatar_path: z.string().nullable().optional(),
  spec: z.enum(['chara_card_v2', 'chara_card_v3']).optional(),
  description: z.string().optional(),
  personality: z.string().optional(),
  scenario: z.string().optional(),
  first_mes: z.string().optional(),
  mes_example: z.string().optional(),
  creator_notes: z.string().optional(),
  system_prompt: z.string().optional(),
  post_history_instructions: z.string().optional(),
  alternate_greetings: stringArray.optional(),
  tags: stringArray.optional(),
  creator: z.string().optional(),
  character_version: z.string().optional(),
  character_book: z.any().optional(),
  extensions: z.record(z.unknown()).optional(),
});

export const personaSchema = z.object({
  name: z.string().min(1),
  avatar_path: z.string().nullable().optional(),
  description: z.string().optional(),
  is_default: z.boolean().optional(),
});

export const presetSchema = z.object({
  name: z.string().min(1),
  config: genConfigSchema,
  is_default: z.boolean().optional(),
});

export const chatCreateSchema = z.object({
  character_id: z.string().nullable().optional(),
  persona_id: z.string().nullable().optional(),
  title: z.string().optional(),
  connection_id: z.string().nullable().optional(),
  model_id: z.string().nullable().optional(),
  gen_config: genConfigSchema.nullable().optional(),
});

export const chatPatchSchema = z.object({
  character_id: z.string().nullable().optional(),
  persona_id: z.string().nullable().optional(),
  title: z.string().optional(),
  connection_id: z.string().nullable().optional(),
  model_id: z.string().nullable().optional(),
  gen_config: genConfigSchema.nullable().optional(),
  author_note: z.string().optional(),
  author_note_position: authorNotePositionSchema.optional(),
  author_note_depth: z.number().int().min(0).max(50).optional(),
  author_note_enabled: z.boolean().optional(),
  rag_enabled: z.boolean().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export const messagePatchSchema = z.object({
  swipes: stringArray.optional(),
  swipe_index: z.number().int().min(0).optional(),
  mode: playModeSchema.nullable().optional(),
  pinned_directive: z.boolean().optional(),
});

export const chatMessageSchema = z.object({
  chatId: z.string().min(1),
  content: z.string().optional(),
  mode: playModeSchema.optional(),
  directive: z
    .object({ content: z.string().min(1), strong: z.boolean().optional() })
    .nullable()
    .optional(),
});

export const regenerateSchema = z.object({
  chatId: z.string().min(1),
  messageId: z.string().min(1),
});

export const continueSchema = z.object({
  chatId: z.string().min(1),
  messageId: z.string().min(1),
});

export const suggestSchema = z.object({
  chatId: z.string().min(1),
});

export const branchSchema = z.object({
  messageId: z.string().min(1),
});

export const behaviorSchema = z
  .object({
    system_prompt: z.string().optional(),
    default_gen_config: genConfigSchema.optional(),
    utility_connection_id: z.string().nullable().optional(),
    utility_model_id: z.string().nullable().optional(),
    embedding_connection_id: z.string().nullable().optional(),
    embedding_model_id: z.string().nullable().optional(),
    rag_top_k: z.number().int().min(1).max(20).optional(),
    rag_threshold: z.number().min(0).max(1).optional(),
    narrator_name: z.string().optional(),
  })
  .strict();

export const promptOrderSchema = z.object({
  order: z.array(
    z.enum([
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
    ]),
  ),
});
