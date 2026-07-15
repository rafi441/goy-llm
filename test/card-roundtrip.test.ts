import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCardJson, serializeCardJson } from '../lib/cards/normalize';
import { embedCardText, extractCardText, isPng } from '../lib/cards/png';
import type { Character } from '../lib/types';

const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC',
  'base64',
);

const SAMPLE_V3 = {
  spec: 'chara_card_v3',
  spec_version: '3.0',
  data: {
    name: 'Alice',
    description: 'A curious librarian. {{char}} loves {{user}}.',
    personality: 'inquisitive, warm',
    scenario: 'A quiet evening in the archive.',
    first_mes: 'Oh, hello there.',
    mes_example: '<START>\nAlice: Welcome.',
    creator_notes: 'test card',
    system_prompt: 'Stay in character.',
    post_history_instructions: 'Keep replies short.',
    alternate_greetings: ['Hey!', 'Good to see you.'],
    tags: ['fantasy', 'slice-of-life'],
    creator: 'tester',
    character_version: '1.2',
    character_book: {
      name: 'Alice Lore',
      scan_depth: 3,
      entries: [
        {
          keys: ['archive', 'library'],
          content: 'The archive holds forbidden books.',
          insertion_order: 10,
          enabled: true,
          constant: false,
          selective: false,
          case_sensitive: false,
        },
      ],
    },
    extensions: { depth_prompt: { depth: 4, prompt: 'stay grounded' }, custom_flag: true },
    nickname: 'Al',
    assets: [{ type: 'icon', uri: 'embeded://a.png' }],
  },
};

function toCharacter(input: ReturnType<typeof parseCardJson>): Character {
  return {
    id: 'x',
    avatar_path: null,
    created_at: 0,
    updated_at: 0,
    name: input.input.name,
    spec: input.input.spec ?? 'chara_card_v3',
    description: input.input.description ?? '',
    personality: input.input.personality ?? '',
    scenario: input.input.scenario ?? '',
    first_mes: input.input.first_mes ?? '',
    mes_example: input.input.mes_example ?? '',
    creator_notes: input.input.creator_notes ?? '',
    system_prompt: input.input.system_prompt ?? '',
    post_history_instructions: input.input.post_history_instructions ?? '',
    alternate_greetings: input.input.alternate_greetings ?? [],
    tags: input.input.tags ?? [],
    creator: input.input.creator ?? '',
    character_version: input.input.character_version ?? '',
    character_book: input.characterBook,
    extensions: input.input.extensions ?? {},
  };
}

test('JSON round-trip is lossless including extensions and unmodeled fields', () => {
  const p1 = parseCardJson(SAMPLE_V3);
  const c1 = toCharacter(p1);
  const j1 = serializeCardJson(c1, 'chara_card_v3');
  const p2 = parseCardJson(j1);

  assert.deepEqual(p2.input, p1.input);
  assert.deepEqual(p2.characterBook, p1.characterBook);

  const dataOut = (j1 as { data: Record<string, unknown> }).data;
  assert.equal(dataOut.nickname, 'Al');
  assert.deepEqual(dataOut.assets, SAMPLE_V3.data.assets);
  assert.deepEqual(dataOut.extensions, SAMPLE_V3.data.extensions);
});

test('PNG embed → extract → parse round-trip (V3 wins over V2)', () => {
  const p1 = parseCardJson(SAMPLE_V3);
  const c1 = toCharacter(p1);
  const v2 = JSON.stringify(serializeCardJson(c1, 'chara_card_v2'));
  const v3 = JSON.stringify(serializeCardJson(c1, 'chara_card_v3'));

  const png = embedCardText(PLACEHOLDER_PNG, [
    { keyword: 'chara', json: v2 },
    { keyword: 'ccv3', json: v3 },
  ]);
  assert.ok(isPng(png));

  const extracted = extractCardText(png);
  assert.ok(extracted);
  assert.equal(extracted!.keyword, 'ccv3');

  const p2 = parseCardJson(JSON.parse(extracted!.raw));
  assert.deepEqual(p2.input, p1.input);
  assert.deepEqual(p2.characterBook, p1.characterBook);
});

test('re-embedding replaces chunks without duplication', () => {
  const png1 = embedCardText(PLACEHOLDER_PNG, [{ keyword: 'ccv3', json: '{"spec":"chara_card_v3","data":{"name":"A"}}' }]);
  const png2 = embedCardText(png1, [{ keyword: 'ccv3', json: '{"spec":"chara_card_v3","data":{"name":"B"}}' }]);
  const extracted = extractCardText(png2);
  assert.ok(extracted);
  assert.equal(JSON.parse(extracted!.raw).data.name, 'B');
});
