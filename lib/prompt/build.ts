import type {
  BuiltPrompt,
  Character,
  LorebookEntry,
  Message,
  OobMode,
  Persona,
  PromptBlock,
  PromptOrderKey,
  ProviderMessage,
} from '../types';
import { estimateTokens } from '../tokenizer';
import { resolveMacros, type MacroContext } from './macros';
import { scanLorebook } from './lorebook';

export interface DirectiveInput {
  content: string;
  oobMode: OobMode;
  strong?: boolean;
}

export interface BuildPromptArgs {
  order: PromptOrderKey[];
  systemPrompt: string;
  character: Character | null;
  persona: Persona | null;
  messages: Message[];
  directive?: DirectiveInput | null;
  retrievals?: { content: string }[];
  lorebookEntries?: LorebookEntry[];
  contextLength: number;
  reservedTokens: number;
  macro: MacroContext;
  narratorName: string;
  authorNote: string;
  authorNotePosition: 'system' | 'depth' | 'after';
  authorNoteDepth: number;
  authorNoteEnabled: boolean;
}

function m(text: string, ctx: MacroContext): string {
  return resolveMacros(text, ctx).trim();
}

function currentContent(msg: Message): string {
  return msg.swipes[msg.swipe_index] ?? msg.swipes[0] ?? '';
}

function directorTemplate(directive: DirectiveInput, ctx: MacroContext): string {
  if (directive.oobMode === 'user_prefix') {
    return `[OOC: ${directive.content.trim()}]`;
  }
  const strong = directive.strong
    ? '\n\nIMPORTANT: This is NOT dialogue. Never quote, reply to, or acknowledge this note inside your response. Write the in-character narration or dialogue directly.'
    : '';
  return (
    `[DIRECTOR NOTE — out of character. This is an instruction from the author to you, not something ${ctx.user} said. ` +
    `Do not mention, quote, or respond to this note as dialogue.]\n` +
    `${directive.content.trim()}\n` +
    `Continue ${ctx.char}'s next response according to this direction.${strong}`
  );
}

function formatCharacter(char: Character, ctx: MacroContext): string {
  const parts: string[] = [];
  const name = char.name;
  if (char.description) parts.push(`${name}'s description:\n${m(char.description, ctx)}`);
  if (char.personality) parts.push(`${name}'s personality: ${m(char.personality, ctx)}`);
  if (char.scenario) parts.push(`Scenario: ${m(char.scenario, ctx)}`);
  return parts.join('\n\n');
}

function historyToProvider(msg: Message, ctx: MacroContext): ProviderMessage {
  return { role: msg.role, content: m(currentContent(msg), ctx) };
}

export function buildPrompt(args: BuildPromptArgs): BuiltPrompt {
  const ctx = args.macro;
  const char = args.character;

  const historyMessages = args.messages.filter(
    (msg) => msg.type !== 'directive' || msg.pinned_directive === 1,
  );
  const historyText = historyMessages.map((msg) => currentContent(msg));

  const lorebook = scanLorebook(args.lorebookEntries ?? [], historyText, 512, estimateTokens);
  const activeLorebookEntries = lorebook.active.map((e) => ({
    id: e.id,
    keys: e.keys,
    tokens: estimateTokens(e.content),
  }));

  const systemContent =
    char && char.system_prompt.trim()
      ? m(char.system_prompt, ctx)
      : m(args.systemPrompt, ctx);

  const blockContent: Record<PromptOrderKey, string> = {
    system_prompt: systemContent,
    character: char ? formatCharacter(char, ctx) : '',
    persona:
      args.persona && args.persona.description
        ? `${args.persona.name}'s persona: ${m(args.persona.description, ctx)}`
        : '',
    author_note_system:
      args.authorNoteEnabled && args.authorNotePosition === 'system' && args.authorNote.trim()
        ? m(args.authorNote, ctx)
        : '',
    lorebook: lorebook.active.map((e) => m(e.content, ctx)).join('\n\n'),
    rag:
      (args.retrievals ?? []).length > 0
        ? `Relevant context:\n${(args.retrievals ?? []).map((r) => r.content).join('\n\n')}`
        : '',
    example_messages: char && char.mes_example.trim() ? `Example dialogue:\n${m(char.mes_example, ctx)}` : '',
    chat_history: '',
    author_note_depth: '',
    post_history:
      char && char.post_history_instructions.trim() ? m(char.post_history_instructions, ctx) : '',
    director: '',
  };

  const preHistoryKeys: PromptOrderKey[] = [];
  const postHistoryKeys: PromptOrderKey[] = [];
  let seenHistory = false;
  for (const key of args.order) {
    if (key === 'chat_history') {
      seenHistory = true;
      continue;
    }
    if (key === 'author_note_depth' || key === 'director') continue;
    if (seenHistory) postHistoryKeys.push(key);
    else preHistoryKeys.push(key);
  }

  const blocks: PromptBlock[] = [];
  const preMessages: ProviderMessage[] = [];
  for (const key of preHistoryKeys) {
    const content = blockContent[key];
    if (!content.trim()) continue;
    const tokens = estimateTokens(content);
    blocks.push({ label: key, role: 'system', content, tokens });
    preMessages.push({ role: 'system', content });
  }

  const postMessages: ProviderMessage[] = [];
  for (const key of postHistoryKeys) {
    const content = blockContent[key];
    if (!content.trim()) continue;
    const tokens = estimateTokens(content);
    blocks.push({ label: key, role: 'system', content, tokens });
    postMessages.push({ role: 'system', content });
  }

  const directiveContent = args.directive?.content.trim()
    ? directorTemplate(args.directive, ctx)
    : '';
  const directiveMsg: ProviderMessage | null = directiveContent
    ? {
        role: args.directive!.oobMode === 'user_prefix' ? 'user' : 'system',
        content: directiveContent,
      }
    : null;

  const budget = Math.max(256, args.contextLength - args.reservedTokens);

  const fixedTokens =
    [...preMessages, ...postMessages].reduce((s, pm) => s + estimateTokens(pm.content) + 4, 0) +
    (directiveMsg ? estimateTokens(directiveMsg.content) + 4 : 0);

  const providerHistory = historyMessages.map((msg) => historyToProvider(msg, ctx));

  let truncatedAt: string | null = null;
  let startIdx = 0;
  let runningHistoryTokens = providerHistory.reduce((s, pm) => s + estimateTokens(pm.content) + 4, 0);

  const authorNoteDepthContent =
    args.authorNoteEnabled && args.authorNotePosition === 'depth' && args.authorNote.trim()
      ? m(args.authorNote, ctx)
      : '';
  const depthNoteTokens = authorNoteDepthContent ? estimateTokens(authorNoteDepthContent) + 4 : 0;

  while (
    startIdx < providerHistory.length - 1 &&
    fixedTokens + runningHistoryTokens + depthNoteTokens > budget
  ) {
    runningHistoryTokens -= estimateTokens(providerHistory[startIdx]!.content) + 4;
    startIdx += 1;
  }
  if (startIdx > 0) {
    truncatedAt = historyMessages[startIdx]?.id ?? null;
  }

  const keptHistory = providerHistory.slice(startIdx);

  let finalHistory: ProviderMessage[] = keptHistory;
  if (authorNoteDepthContent) {
    const depth = Math.max(0, args.authorNoteDepth);
    const insertAt = Math.max(0, keptHistory.length - depth);
    finalHistory = [
      ...keptHistory.slice(0, insertAt),
      { role: 'system', content: authorNoteDepthContent },
      ...keptHistory.slice(insertAt),
    ];
    blocks.push({
      label: 'author_note_depth',
      role: 'system',
      content: authorNoteDepthContent,
      tokens: estimateTokens(authorNoteDepthContent),
    });
  }

  for (const [i, pm] of keptHistory.entries()) {
    blocks.push({
      label: `history[${startIdx + i}]:${pm.role}`,
      role: pm.role,
      content: pm.content,
      tokens: estimateTokens(pm.content),
    });
  }

  if (directiveMsg) {
    blocks.push({
      label: 'director',
      role: directiveMsg.role,
      content: directiveMsg.content,
      tokens: estimateTokens(directiveMsg.content),
      ephemeral: true,
    });
  }

  const messages: ProviderMessage[] = [
    ...preMessages,
    ...finalHistory,
    ...postMessages,
    ...(directiveMsg ? [directiveMsg] : []),
  ];

  const totalTokens = messages.reduce((s, pm) => s + estimateTokens(pm.content) + 4, 0) + 2;

  return {
    messages,
    blocks,
    totalTokens,
    budget,
    truncatedAt,
    activeLorebookEntries,
  };
}
