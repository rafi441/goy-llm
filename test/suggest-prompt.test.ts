import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSuggestMessages } from '../lib/prompt/suggest';

const ctx = {
  charName: 'Alice',
  charDescription: 'A librarian.',
  charPersonality: 'warm',
  charScenario: 'the archive',
  personaName: 'Bob',
  personaDescription: 'an adventurer',
  authorNote: 'Keep it tense.',
  lorebook: ['The archive is forbidden after dark.'],
  transcript: 'user: hi\nassistant: Alice nods.',
};

test('as_user asks for player actions and grounds in note + lorebook', () => {
  const { system, user } = buildSuggestMessages('as_user', ctx);
  assert.match(system, /player/i);
  assert.match(user, /Keep it tense/);
  assert.match(user, /forbidden after dark/);
});

test("as_char asks for the character's own lines", () => {
  const { system } = buildSuggestMessages('as_char', ctx);
  assert.match(system, /Alice|character/i);
  assert.match(system, /say|do/i);
});

test('narrator asks for scene beats', () => {
  const { system } = buildSuggestMessages('narrator', ctx);
  assert.match(system, /scene|narrat/i);
});
