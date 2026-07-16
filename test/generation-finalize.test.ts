import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generationFinalizeInput } from '../lib/api/finalize';

test('as_user (impersonate) persists nothing', () => {
  assert.equal(generationFinalizeInput('as_user', 'chat1', 'hello'), null);
});

test('as_char persists an assistant chat message', () => {
  const input = generationFinalizeInput('as_char', 'chat1', 'Alice smiles.');
  assert.deepEqual(input, {
    chat_id: 'chat1',
    role: 'assistant',
    type: 'chat',
    mode: null,
    swipes: ['Alice smiles.'],
  });
});

test('narrator persists an assistant narration message', () => {
  const input = generationFinalizeInput('narrator', 'chat1', 'The storm breaks.');
  assert.deepEqual(input, {
    chat_id: 'chat1',
    role: 'assistant',
    type: 'narration',
    mode: 'narrator',
    swipes: ['The storm breaks.'],
  });
});
