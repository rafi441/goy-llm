import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMacros } from '../lib/prompt/macros';

test('renderMacros resolves {{char}} and {{user}}', () => {
  assert.equal(renderMacros('{{char}} greets {{user}}.', 'Alice', 'Bob'), 'Alice greets Bob.');
});

test('renderMacros is case-insensitive and idempotent', () => {
  const once = renderMacros('{{Char}} and {{USER}}', 'Alice', 'Bob');
  assert.equal(once, 'Alice and Bob');
  assert.equal(renderMacros(once, 'Alice', 'Bob'), once); // already-resolved text unchanged
});

test('renderMacros leaves unknown macros untouched', () => {
  assert.equal(renderMacros('keep {{unknown}}', 'Alice', 'Bob'), 'keep {{unknown}}');
});
