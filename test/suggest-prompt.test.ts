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

test('as_user asks for the player line and grounds in note + lorebook', () => {
  const { system, user } = buildSuggestMessages('as_user', ctx);
  assert.match(system, /Bob the player/);
  assert.match(system, /first-person/i);
  assert.match(system, /Never speak or act for Alice/);
  assert.match(user, /Keep it tense/);
  assert.match(user, /forbidden after dark/);
});

test("as_char asks for Alice's own line, never the player's", () => {
  const { system } = buildSuggestMessages('as_char', ctx);
  assert.match(system, /Alice could say or do/);
  assert.match(system, /Never write for Bob/);
});

test('narrator asks for neutral narration with no character dialogue', () => {
  const { system } = buildSuggestMessages('narrator', ctx);
  assert.match(system, /narration/i);
  assert.match(system, /Do NOT write dialogue or actions for Alice or Bob/);
});

test('the three modes produce distinct instructions', () => {
  const a = buildSuggestMessages('as_user', ctx).system;
  const b = buildSuggestMessages('as_char', ctx).system;
  const c = buildSuggestMessages('narrator', ctx).system;
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.notEqual(a, c);
});
