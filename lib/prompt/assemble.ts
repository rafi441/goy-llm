import 'server-only';
import type { BuiltPrompt, GenConfig, Message, OobMode, PlayMode } from '../types';
import { getChat } from '../db/repos/chats';
import { getCharacter } from '../db/repos/characters';
import { getPersona, getDefaultPersona } from '../db/repos/personas';
import { listMessages, currentContent } from '../db/repos/messages';
import { getConnection, getDecryptedKey } from '../db/repos/connections';
import { getModelContextLength } from '../db/repos/models';
import { entriesForCharacter } from '../db/repos/lorebooks';
import { getBehavior } from '../db/repos/settings';
import { getPromptOrder } from '../db/repos/settings';
import { retrieve } from '../db/repos/rag';
import { getProvider } from '../providers';
import { buildPrompt, type DirectiveInput } from './build';
import { makeMacroContext } from './macros';

export interface AssembleOptions {
  directive?: { content: string; strong?: boolean } | null;
  excludeMessageIds?: string[];
  upToMessageId?: string;
  genMode?: PlayMode;
  impersonateInput?: string;
}

export interface AssembledPrompt {
  built: BuiltPrompt;
  connectionId: string | null;
  modelId: string | null;
  genConfig: GenConfig;
  oobMode: OobMode;
  characterName: string;
  personaName: string;
}

export async function assemblePrompt(
  chatId: string,
  opts: AssembleOptions = {},
): Promise<AssembledPrompt> {
  const chat = getChat(chatId);
  if (!chat) throw new Error('Chat not found');

  const character = chat.character_id ? (getCharacter(chat.character_id) ?? null) : null;
  const persona = chat.persona_id ? (getPersona(chat.persona_id) ?? null) : (getDefaultPersona() ?? null);
  const behavior = getBehavior();
  const order = getPromptOrder();

  let messages = listMessages(chatId);
  if (opts.upToMessageId) {
    const idx = messages.findIndex((msg) => msg.id === opts.upToMessageId);
    if (idx >= 0) messages = messages.slice(0, idx + 1);
  }
  if (opts.excludeMessageIds?.length) {
    const exclude = new Set(opts.excludeMessageIds);
    messages = messages.filter((msg) => !exclude.has(msg.id));
  }

  const genConfig: GenConfig = { ...behavior.default_gen_config, ...(chat.gen_config ?? {}) };
  const connection = chat.connection_id ? getConnection(chat.connection_id) : undefined;
  const oobMode: OobMode = connection?.oob_mode ?? 'system';

  const contextLength =
    (chat.connection_id && chat.model_id
      ? getModelContextLength(chat.connection_id, chat.model_id)
      : null) ?? 8192;

  const lorebookEntries = entriesForCharacter(chat.character_id);

  let retrievals: { content: string }[] = [];
  if (chat.rag_enabled && behavior.embedding_connection_id && behavior.embedding_model_id) {
    const lastUser = [...messages].reverse().find((msg) => msg.role === 'user');
    if (lastUser) {
      try {
        const embConn = getConnection(behavior.embedding_connection_id);
        if (embConn) {
          const provider = getProvider(
            embConn.type,
            embConn.base_url,
            getDecryptedKey(embConn.id),
          );
          const [queryVec] = await provider.embed([currentContent(lastUser)], behavior.embedding_model_id);
          if (queryVec) {
            retrievals = retrieve(chatId, queryVec, behavior.rag_top_k, behavior.rag_threshold).map(
              (c) => ({ content: c.content }),
            );
          }
        }
      } catch {
        retrievals = [];
      }
    }
  }

  const directive: DirectiveInput | null = opts.directive?.content
    ? { content: opts.directive.content, oobMode, strong: opts.directive.strong }
    : null;

  const built = buildPrompt({
    order,
    systemPrompt: behavior.system_prompt,
    character,
    persona,
    messages,
    directive,
    retrievals,
    lorebookEntries,
    contextLength,
    reservedTokens: genConfig.max_tokens ?? 512,
    macro: makeMacroContext(
      character?.name ?? 'Character',
      persona?.name ?? 'User',
      persona?.description ?? '',
    ),
    narratorName: behavior.narrator_name,
    authorNote: chat.author_note,
    authorNotePosition: chat.author_note_position,
    authorNoteDepth: chat.author_note_depth,
    authorNoteEnabled: chat.author_note_enabled === 1,
    oobMode,
    genMode: opts.genMode,
    impersonateInput: opts.impersonateInput,
  });

  return {
    built,
    connectionId: chat.connection_id,
    modelId: chat.model_id,
    genConfig,
    oobMode,
    characterName: character?.name ?? 'Character',
    personaName: persona?.name ?? 'User',
  };
}
