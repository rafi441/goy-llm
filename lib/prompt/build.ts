import type {
  BuiltPrompt,
  Character,
  LorebookEntry,
  Message,
  OobMode,
  Persona,
  PlayMode,
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
  oobMode?: OobMode;
  genMode?: PlayMode;
  impersonateInput?: string;
}

function m(text: string, ctx: MacroContext): string {
  return resolveMacros(text, ctx).trim();
}

function currentContent(msg: Message): string {
  return msg.swipes[msg.swipe_index] ?? msg.swipes[0] ?? '';
}

function directorTemplate(directive: DirectiveInput, ctx: MacroContext, asUser: boolean): string {
  const content = m(directive.content, ctx);
  const strong = directive.strong ? ` Do not quote or acknowledge this note.` : '';

  if (asUser) {
    return `[OOC — director instruction, not my line: ${content} Continue in character as ${ctx.char}.${strong}]`;
  }

  return (
    `[Director note — out of character, not dialogue. ${content} ` +
    `Now continue in character as ${ctx.char}: write only ${ctx.char}'s narration and dialogue, no meta.${strong}]`
  );
}

function buildModeSteer(
  genMode: PlayMode | undefined,
  ctx: MacroContext,
  impersonateInput?: string,
): string {
  if (genMode === 'as_user') {
    const seed = impersonateInput?.trim();
    if (seed) {
      return (
        `[OOC — impersonation: ${ctx.user} has drafted a rough version of their next message: "${seed}". ` +
        `Rewrite and expand it into ${ctx.user}'s full next message — first person as ${ctx.user}, ` +
        `preserving their intent, wording choices, and any specifics, in the established style. ` +
        `Do not write, narrate, or speak for ${ctx.char}. Stop before ${ctx.char} responds.]`
      );
    }
    return (
      `[OOC — impersonation: Write ${ctx.user}'s next message only. ` +
      `First person as ${ctx.user} — their words, thoughts, and actions in the established style. ` +
      `Do not write, narrate, or speak for ${ctx.char}. Stop before ${ctx.char} responds.]`
    );
  }
  if (genMode === 'narrator') {
    return (
      `[OOC — narration: You are the Narrator. Write neutral third-person narration that advances ` +
      `the scene — actions, environment, atmosphere. Do not write dialogue for ${ctx.char} or ${ctx.user}.]`
    );
  }
  return '';
}

function mergeAdjacentRoles(messages: ProviderMessage[]): ProviderMessage[] {
  const out: ProviderMessage[] = [];
  for (const msg of messages) {
    const prev = out[out.length - 1];
    if (prev && prev.role === msg.role) {
      prev.content = `${prev.content}\n\n${msg.content}`;
    } else {
      out.push({ ...msg });
    }
  }
  return out;
}

function authorNoteTemplate(content: string, ctx: MacroContext): string {
  return (
    `[AUTHOR'S NOTE — out-of-character guidance from the author to you, the model. ` +
    `Treat it as true and let it steer ${ctx.char}'s next writing. ` +
    `It is not dialogue and ${ctx.user} did not say it — do not quote or reply to it.]\n` +
    content
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

function standingDirectiveTemplate(content: string, ctx: MacroContext): string {
  return `[Director note — out of character, not dialogue. ${content} Stay in character as ${ctx.char}.]`;
}

function historyToProvider(msg: Message, ctx: MacroContext): ProviderMessage {
  const content = m(currentContent(msg), ctx);
  if (msg.type === 'directive') return { role: 'system', content: standingDirectiveTemplate(content, ctx) };
  if (msg.type === 'narration') return { role: 'assistant', content };
  return { role: msg.role, content };
}

export function buildPrompt(args: BuildPromptArgs): BuiltPrompt {
  const ctx = args.macro;
  const char = args.character;

  const historyMessages = args.messages.filter(
    (msg) => msg.type !== 'describe' && (msg.type !== 'directive' || msg.pinned_directive === 1),
  );
  const historyText = historyMessages.map((msg) => currentContent(msg));

  const lorebook = scanLorebook(args.lorebookEntries ?? [], historyText, 512, estimateTokens);
  const activeLorebookEntries = lorebook.active.map((e) => ({
    id: e.id,
    keys: e.keys,
    tokens: estimateTokens(e.content),
  }));

  const systemContent = [m(args.systemPrompt, ctx), char ? m(char.system_prompt, ctx) : '']
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n\n');

  const blockContent: Record<PromptOrderKey, string> = {
    system_prompt: systemContent,
    character: char ? formatCharacter(char, ctx) : '',
    persona:
      args.persona && args.persona.description
        ? `${args.persona.name}'s persona: ${m(args.persona.description, ctx)}`
        : '',
    author_note_system:
      args.authorNoteEnabled && args.authorNotePosition === 'system' && args.authorNote.trim()
        ? authorNoteTemplate(m(args.authorNote, ctx), ctx)
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

  const lastMsgRole = historyMessages.length
    ? historyMessages[historyMessages.length - 1]!.role
    : null;
  const directiveAsUser = args.directive
    ? args.directive.oobMode === 'user_prefix' || lastMsgRole !== 'user'
    : false;
  const directiveContent = args.directive?.content.trim()
    ? directorTemplate(args.directive, ctx, directiveAsUser)
    : '';
  const directiveMsg: ProviderMessage | null = directiveContent
    ? { role: directiveAsUser ? 'user' : 'system', content: directiveContent }
    : null;

  const trailingAsUser = (args.oobMode ?? 'system') === 'user_prefix' || lastMsgRole !== 'user';
  const modeSteerContent = buildModeSteer(args.genMode, ctx, args.impersonateInput);
  const modeSteerMsg: ProviderMessage | null = modeSteerContent
    ? { role: trailingAsUser ? 'user' : 'system', content: modeSteerContent }
    : null;

  const budget = Math.max(256, args.contextLength - args.reservedTokens);

  const fixedTokens =
    [...preMessages, ...postMessages].reduce((s, pm) => s + estimateTokens(pm.content) + 4, 0) +
    (directiveMsg ? estimateTokens(directiveMsg.content) + 4 : 0) +
    (modeSteerMsg ? estimateTokens(modeSteerMsg.content) + 4 : 0);

  const providerHistory = historyMessages.map((msg) => historyToProvider(msg, ctx));

  let truncatedAt: string | null = null;
  let startIdx = 0;
  let runningHistoryTokens = providerHistory.reduce((s, pm) => s + estimateTokens(pm.content) + 4, 0);

  const inHistoryNote =
    args.authorNoteEnabled &&
    (args.authorNotePosition === 'depth' || args.authorNotePosition === 'after') &&
    args.authorNote.trim();
  const authorNoteDepthContent = inHistoryNote ? authorNoteTemplate(m(args.authorNote, ctx), ctx) : '';
  const authorNoteInsertDepth = args.authorNotePosition === 'after' ? 0 : Math.max(0, args.authorNoteDepth);
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
    const insertAt = Math.max(0, keptHistory.length - authorNoteInsertDepth);
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

  if (modeSteerMsg) {
    blocks.push({
      label: 'mode_steer',
      role: modeSteerMsg.role,
      content: modeSteerMsg.content,
      tokens: estimateTokens(modeSteerMsg.content),
      ephemeral: true,
    });
  }

  const messages = mergeAdjacentRoles([
    ...preMessages,
    ...finalHistory,
    ...postMessages,
    ...(directiveMsg ? [directiveMsg] : []),
    ...(modeSteerMsg ? [modeSteerMsg] : []),
  ]);

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
