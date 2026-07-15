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
  assert.match(last.content, /DIRECTOR NOTE/);
  assert.match(last.content, /Alice loses her temper/);
  const directorBlock = built.blocks.find((b) => b.label === 'director');
  assert.ok(directorBlock?.ephemeral);
});

test('director user_prefix fallback uses [OOC:] as a user message', () => {
  const built = buildPrompt({
    ...base,
    messages: [msg('m1', 'user', 'hello', 1)],
    directive: { content: 'make her angry', oobMode: 'user_prefix' },
  });
  const last = built.messages[built.messages.length - 1]!;
  assert.equal(last.role, 'user');
  assert.equal(last.content, '[OOC: make her angry]');
});

test('macros resolve at build time', () => {
  const built = buildPrompt({ ...base, messages: [msg('m1', 'user', 'hi', 1)] });
  const charBlock = built.blocks.find((b) => b.label === 'character');
  assert.match(charBlock!.content, /adores Bob/);
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
