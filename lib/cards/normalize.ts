import type { CardSpec, Character, CharacterBook } from '../types';
import type { CharacterInput } from '../db/repos/characters';

const EXTRA_KEY = '__goyllm_data_extra__';

const MODELED_DATA_KEYS = new Set([
  'name',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'creator_notes',
  'system_prompt',
  'post_history_instructions',
  'alternate_greetings',
  'tags',
  'creator',
  'character_version',
  'character_book',
  'extensions',
]);

type RawObj = Record<string, unknown>;

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'string' ? v : String(v);
}

function strArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str);
  return [];
}

function asObj(v: unknown): RawObj {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as RawObj) : {};
}

export interface ParsedCard {
  input: CharacterInput;
  detectedSpec: CardSpec;
  characterBook: CharacterBook | null;
}

export function parseCardJson(obj: unknown): ParsedCard {
  const root = asObj(obj);
  let data: RawObj;
  let detectedSpec: CardSpec;

  if (root.spec === 'chara_card_v3') {
    data = asObj(root.data);
    detectedSpec = 'chara_card_v3';
  } else if (root.spec === 'chara_card_v2' || (root.data && typeof root.data === 'object')) {
    data = asObj(root.data);
    detectedSpec = 'chara_card_v2';
  } else {
    data = root;
    detectedSpec = 'chara_card_v2';
  }

  const extensions = { ...asObj(data.extensions) };
  const extra: RawObj = {};
  for (const [k, v] of Object.entries(data)) {
    if (!MODELED_DATA_KEYS.has(k)) extra[k] = v;
  }
  if (Object.keys(extra).length > 0) extensions[EXTRA_KEY] = extra;

  const book = data.character_book ? (asObj(data.character_book) as unknown as CharacterBook) : null;

  const input: CharacterInput = {
    name: str(data.name) || 'Unnamed',
    spec: detectedSpec,
    description: str(data.description),
    personality: str(data.personality),
    scenario: str(data.scenario),
    first_mes: str(data.first_mes),
    mes_example: str(data.mes_example),
    creator_notes: str(data.creator_notes),
    system_prompt: str(data.system_prompt),
    post_history_instructions: str(data.post_history_instructions),
    alternate_greetings: strArray(data.alternate_greetings),
    tags: strArray(data.tags),
    creator: str(data.creator),
    character_version: str(data.character_version),
    character_book: book,
    extensions,
  };

  return { input, detectedSpec, characterBook: book };
}

export function serializeCardJson(character: Character, targetSpec: CardSpec): RawObj {
  const extensions = { ...character.extensions };
  const extra = asObj(extensions[EXTRA_KEY]);
  delete extensions[EXTRA_KEY];

  const data: RawObj = {
    name: character.name,
    description: character.description,
    personality: character.personality,
    scenario: character.scenario,
    first_mes: character.first_mes,
    mes_example: character.mes_example,
    creator_notes: character.creator_notes,
    system_prompt: character.system_prompt,
    post_history_instructions: character.post_history_instructions,
    alternate_greetings: character.alternate_greetings,
    tags: character.tags,
    creator: character.creator,
    character_version: character.character_version,
    extensions,
    ...extra,
  };

  if (character.character_book) data.character_book = character.character_book as unknown as RawObj;

  return {
    spec: targetSpec,
    spec_version: targetSpec === 'chara_card_v3' ? '3.0' : '2.0',
    data,
  };
}
