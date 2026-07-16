import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from '../lib/prompt/build';
import { makeMacroContext } from '../lib/prompt/macros';
import { PROMPT_ORDER_KEYS } from '../lib/types';
import type { Character, Message, Persona } from '../lib/types';

function char(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c',
    name: 'Alice',
    avatar_path: null,
    spec: 'chara_card_v3',
    description: 'A librarian who adores {{user}}.',
    personality: 'warm',
    scenario: 'the archive',
    first_mes: 'Hi',
    mes_example: '',
    creator_notes: '',
    system_prompt: '',
    post_history_instructions: 'Stay concise.',
    alternate_greetings: [],
    tags: [],
    creator: '',
    character_version: '',
    character_book: null,
    extensions: {},
    created_at: 0,
    updated_at: 0,
    ...overrides,
  };
}

function persona(): Persona {
  return { id: 'p', name: 'Bob', avatar_path: null, description: 'brave adventurer', is_default: 1, created_at: 0 };
}

function msg(id: string, role: Message['role'], text: string, createdAt: number): Message {
  return {
    id,
    chat_id: 'chat',
    role,
    type: 'chat',
    mode: null,
    swipes: [text],
    swipe_index: 0,
    pinned_directive: 0,
    token_count: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

const macro = makeMacroContext('Alice', 'Bob', 'brave adventurer', new Date('2020-01-01T00:00:00Z'), () => 0);

const base = {
  order: [...PROMPT_ORDER_KEYS],
  systemPrompt: 'You are a roleplay engine.',
  character: char(),
  persona: persona(),
  narratorName: 'Narrator',
  authorNote: '',
  authorNotePosition: 'depth' as const,
  authorNoteDepth: 4,
  authorNoteEnabled: false,
  contextLength: 8192,
  reservedTokens: 512,
  macro,
};

test('director directive is injected last as ephemeral system message', () => {
  const built = buildPrompt({
    ...base,
    messages: [msg('m1', 'user', 'Alice, are you okay?', 1)],
    directive: { content: 'Alice loses her temper.', oobMode: 'system' },
  });
  const last = built.messages[built.messages.length - 1]!;
  assert.equal(last.role, 'system');
  assert.match(last.content, /Director note/i);
  assert.match(last.content, /Alice loses her temper/);
  const directorBlock = built.blocks.find((b) => b.label === 'director');
  assert.ok(directorBlock?.ephemeral);
});

test('director after an assistant turn is delivered as a user turn (avoids empty reply)', () => {
  const built = buildPrompt({
    ...base,
    messages: [msg('m1', 'assistant', 'A greeting from Alice.', 1)],
    directive: { content: 'she tells me a secret', oobMode: 'system' },
  });
  const last = built.messages[built.messages.length - 1]!;
  assert.equal(last.role, 'user', 'must end on a user turn so the model answers');
  assert.match(last.content, /she tells me a secret/);
  assert.match(last.content, /OOC/);
});

test('director user_prefix fallback uses [OOC:] as a user message', () => {
  const built = buildPrompt({
    ...base,
    messages: [msg('m1', 'user', 'hello', 1)],
    directive: { content: 'make her angry', oobMode: 'user_prefix' },
  });
  const last = built.messages[built.messages.length - 1]!;
  assert.equal(last.role, 'user');
  assert.match(last.content, /make her angry/);
  assert.match(last.content, /OOC/);
  assert.match(last.content, /not my line/i);
});

test('no consecutive same-role messages are sent (DeepSeek/strict backend safe)', () => {
  const built = buildPrompt({
    ...base,
    messages: [msg('m1', 'user', 'hi', 1), msg('m2', 'assistant', 'hello', 2)],
    directive: { content: 'raise the stakes', oobMode: 'system' },
  });
  for (let i = 1; i < built.messages.length; i++) {
    assert.notEqual(
      built.messages[i]!.role,
      built.messages[i - 1]!.role,
      `messages ${i - 1} and ${i} share role ${built.messages[i]!.role}`,
    );
  }
});

test('director directive resolves macros', () => {
  const built = buildPrompt({
    ...base,
    messages: [msg('m1', 'user', 'hi', 1)],
    directive: { content: '{{char}} confronts {{user}} about the letter.', oobMode: 'system' },
  });
  const last = built.messages[built.messages.length - 1]!;
  assert.match(last.content, /Alice confronts Bob about the letter/);
  assert.doesNotMatch(last.content, /\{\{char\}\}|\{\{user\}\}/);
});

test('macros resolve at build time', () => {
  const built = buildPrompt({ ...base, messages: [msg('m1', 'user', 'hi', 1)] });
  const charBlock = built.blocks.find((b) => b.label === 'character');
  assert.match(charBlock!.content, /adores Bob/);
});

test('global system prompt is the baseline and character prompt appends after it', () => {
  const built = buildPrompt({
    ...base,
    systemPrompt: 'You are a roleplay engine.',
    character: char({ system_prompt: 'Speak in archaic English.' }),
    messages: [msg('m1', 'user', 'hi', 1)],
  });
  const sys = built.blocks.find((b) => b.label === 'system_prompt')!;
  assert.match(sys.content, /You are a roleplay engine\./);
  assert.match(sys.content, /Speak in archaic English\./);
  assert.ok(
    sys.content.indexOf('roleplay engine') < sys.content.indexOf('archaic'),
    'global must come before the character prompt',
  );
});

test('character-only system prompt still renders when global is empty', () => {
  const built = buildPrompt({
    ...base,
    systemPrompt: '',
    character: char({ system_prompt: 'CHAR-ONLY' }),
    messages: [msg('m1', 'user', 'hi', 1)],
  });
  assert.match(built.blocks.find((b) => b.label === 'system_prompt')!.content, /CHAR-ONLY/);
});

test('as_user genMode adds an impersonation steer for the persona and ends answerable', () => {
  const built = buildPrompt({
    ...base,
    genMode: 'as_user',
    messages: [msg('m1', 'assistant', 'Alice greets you.', 1)],
  });
  const last = built.messages[built.messages.length - 1]!;
  assert.equal(last.role, 'user', 'after an assistant turn the steer must be a user turn');
  assert.match(last.content, /Write Bob's next message/);
  assert.match(last.content, /Do not write, narrate, or speak for Alice/);
  const block = built.blocks.find((b) => b.label === 'mode_steer');
  assert.ok(block?.ephemeral);
});

test('narrator genMode adds a neutral narration steer with no character dialogue', () => {
  const built = buildPrompt({
    ...base,
    genMode: 'narrator',
    messages: [msg('m1', 'user', 'hi', 1)],
  });
  const steer = built.messages[built.messages.length - 1]!;
  assert.match(steer.content, /You are the Narrator/);
  assert.match(steer.content, /Do not write dialogue for Alice or Bob/);
});

test('as_char genMode adds no steer (no regression)', () => {
  const built = buildPrompt({ ...base, genMode: 'as_char', messages: [msg('m1', 'user', 'hi', 1)] });
  assert.equal(built.blocks.find((b) => b.label === 'mode_steer'), undefined);
});

test('truncation drops oldest history but keeps system, character, persona', () => {
  const messages = Array.from({ length: 40 }, (_, i) =>
    msg(`m${i}`, i % 2 === 0 ? 'user' : 'assistant', `Message number ${i} with some filler text to add tokens.`, i + 1),
  );
  const built = buildPrompt({ ...base, contextLength: 300, reservedTokens: 50, messages });

  assert.ok(built.truncatedAt, 'expected truncation to occur');
  assert.ok(built.blocks.some((b) => b.label === 'system_prompt'));
  assert.ok(built.blocks.some((b) => b.label === 'character'));
  assert.ok(built.blocks.some((b) => b.label === 'persona'));

  const historyBlocks = built.blocks.filter((b) => b.label.startsWith('history['));
  assert.ok(historyBlocks.length < messages.length, 'history should be trimmed');
  assert.ok(built.totalTokens <= built.budget + 60);
});

test("author's note at depth is inserted inside history", () => {
  const messages = Array.from({ length: 6 }, (_, i) => msg(`m${i}`, i % 2 === 0 ? 'user' : 'assistant', `line ${i}`, i + 1));
  const built = buildPrompt({
    ...base,
    authorNote: 'Remember it is raining.',
    authorNoteEnabled: true,
    authorNotePosition: 'depth',
    authorNoteDepth: 2,
    messages,
  });
  const noteIdx = built.messages.findIndex((m) => m.content.includes('raining'));
  assert.ok(noteIdx > 0 && noteIdx < built.messages.length - 1);
});

test("author's note 'after' is injected at the end of history", () => {
  const messages = Array.from({ length: 4 }, (_, i) => msg(`m${i}`, i % 2 === 0 ? 'user' : 'assistant', `line ${i}`, i + 1));
  const built = buildPrompt({
    ...base,
    authorNote: 'Keep it tense.',
    authorNoteEnabled: true,
    authorNotePosition: 'after',
    messages,
  });
  const noteBlock = built.blocks.find((b) => b.label === 'author_note_depth');
  assert.ok(noteBlock, 'author note must be present, not dropped');
  assert.match(noteBlock!.content, /Keep it tense/);
  const lastLineIdx = built.messages.findIndex((m) => m.content.includes('line 3'));
  const noteIdx = built.messages.findIndex((m) => m.content.includes('Keep it tense'));
  assert.ok(noteIdx > lastLineIdx, 'note sits after the last message');
});
