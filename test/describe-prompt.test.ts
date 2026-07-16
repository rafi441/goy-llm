import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDescribeMessages } from '../lib/prompt/describe';

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

test('as_char describes the character', () => {
  const { system, user } = buildDescribeMessages('Clothing', 'as_char', ctx);
  assert.match(system, /Alice's current clothing/);
  assert.match(user, /Describe Alice's current clothing/);
});

test('as_user describes the player persona', () => {
  const { system } = buildDescribeMessages('Emotion', 'as_user', ctx);
  assert.match(system, /Bob's current emotion/);
});

test('narrator describes the scene', () => {
  const { system } = buildDescribeMessages('Surroundings', 'narrator', ctx);
  assert.match(system, /the current scene's current surroundings/);
});

test('is out-of-character and does not advance the plot', () => {
  const { system } = buildDescribeMessages('Position', 'as_char', ctx);
  assert.match(system, /out-of-character/i);
  assert.match(system, /Do NOT advance the plot/);
});

test('custom aspect is used verbatim', () => {
  const { user } = buildDescribeMessages('injuries', 'as_char', ctx);
  assert.match(user, /Describe Alice's current injuries/);
});
