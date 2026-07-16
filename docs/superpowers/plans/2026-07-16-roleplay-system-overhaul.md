# Roleplay System Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Director, Suggestions, and Play-as-role modes actually drive generation (SillyTavern-style), layer global+character system prompts, and make standing directives + narration backend-safe.

**Architecture:** Thread a single `genMode: PlayMode` field through the existing `assemblePrompt → buildPrompt` pipeline. `buildPrompt` appends one ephemeral "mode-steer" trailing message (same mechanism as the director directive), layers the system prompt, and normalizes directive/narration history turns. `/api/chat` branches its finalize step per mode; impersonation persists nothing and streams into the composer draft.

**Tech Stack:** Next.js 15 (App Router, route handlers), TypeScript, better-sqlite3, Zustand, TanStack Query, zod, `node --test --import tsx`.

## Global Constraints

- Test runner: `npm test` → `node --test --import tsx test/*.test.ts`. New unit tests live in `test/*.test.ts`.
- `lib/prompt/build.ts` must NOT import `server-only` (it is imported by tests). Keep pure. Same for any new file a test imports — use `import type` for types that live in `server-only` modules.
- Typecheck must pass: `npm run typecheck` (`tsc --noEmit`).
- `PlayMode = 'as_user' | 'as_char' | 'narrator'` (`lib/types.ts:3`). `OobMode = 'system' | 'user_prefix'` (`lib/types.ts:2`).
- Macros: `ctx.char`, `ctx.user` (`lib/prompt/macros.ts`). Use these in all steer/frame copy.
- Existing tests in `test/build-prompt.test.ts` must keep passing — new `BuildPromptArgs` fields are OPTIONAL with safe defaults.

---

### Task 1: System-prompt layering (global baseline + character appends)

**Files:**
- Modify: `lib/prompt/build.ts:114-117`
- Test: `test/build-prompt.test.ts`

**Interfaces:**
- Consumes: `BuildPromptArgs.systemPrompt: string`, `args.character.system_prompt: string`, `m(text, ctx)` helper (existing, `lib/prompt/build.ts:41`).
- Produces: `system_prompt` block content = global then character, both when present.

- [ ] **Step 1: Write the failing tests**

Add to `test/build-prompt.test.ts` (after the "macros resolve at build time" test):

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — the append test fails because the character prompt currently *replaces* the global (`sys.content` won't contain "roleplay engine").

- [ ] **Step 3: Implement the layering**

Replace `lib/prompt/build.ts:114-117`:

```ts
  const systemContent =
    char && char.system_prompt.trim()
      ? m(char.system_prompt, ctx)
      : m(args.systemPrompt, ctx);
```

with:

```ts
  const systemContent = [m(args.systemPrompt, ctx), char ? m(char.system_prompt, ctx) : '']
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n\n');
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (both new tests + all existing).

- [ ] **Step 5: Commit**

```bash
git add lib/prompt/build.ts test/build-prompt.test.ts
git commit -m "feat(prompt): layer global system prompt as baseline, append character prompt"
```

---

### Task 2: `genMode` mode-steer in the prompt pipeline

**Files:**
- Modify: `lib/prompt/build.ts` (imports, `BuildPromptArgs`, add `buildModeSteer`, wire trailing steer)
- Modify: `lib/prompt/assemble.ts` (`AssembleOptions`, `buildPrompt` call)
- Test: `test/build-prompt.test.ts`

**Interfaces:**
- Produces: `BuildPromptArgs` gains `oobMode?: OobMode` and `genMode?: PlayMode`. `AssembleOptions` gains `genMode?: PlayMode`. A `mode_steer` block (ephemeral) appears as the last message when `genMode` is `as_user` or `narrator`.
- Consumes: `lastMsgRole` (existing, `lib/prompt/build.ts:175-177`), `ctx.char`/`ctx.user`.

- [ ] **Step 1: Write the failing tests**

Add to `test/build-prompt.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `genMode` is not an accepted arg / no `mode_steer` block.

- [ ] **Step 3: Add types to the import + `BuildPromptArgs`**

In `lib/prompt/build.ts`, extend the type import block (`lib/prompt/build.ts:1-11`) to include `OobMode` and `PlayMode` (they are already re-exported from `../types`):

```ts
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
```

Add to `BuildPromptArgs` (after `authorNoteEnabled: boolean;`, `lib/prompt/build.ts:38`):

```ts
  oobMode?: OobMode;
  genMode?: PlayMode;
```

- [ ] **Step 4: Add the `buildModeSteer` helper**

Add near `directorTemplate` in `lib/prompt/build.ts` (after `lib/prompt/build.ts:61`):

```ts
function buildModeSteer(genMode: PlayMode | undefined, ctx: MacroContext): string {
  if (genMode === 'as_user') {
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
```

- [ ] **Step 5: Build the trailing steer message**

In `buildPrompt`, immediately AFTER the `directiveMsg` declaration (`lib/prompt/build.ts:184-186`), add:

```ts
  const trailingAsUser = (args.oobMode ?? 'system') === 'user_prefix' || lastMsgRole !== 'user';
  const modeSteerContent = buildModeSteer(args.genMode, ctx);
  const modeSteerMsg: ProviderMessage | null = modeSteerContent
    ? { role: trailingAsUser ? 'user' : 'system', content: modeSteerContent }
    : null;
```

- [ ] **Step 6: Reserve tokens for the steer**

Update `fixedTokens` (`lib/prompt/build.ts:190-192`) to add the steer:

```ts
  const fixedTokens =
    [...preMessages, ...postMessages].reduce((s, pm) => s + estimateTokens(pm.content) + 4, 0) +
    (directiveMsg ? estimateTokens(directiveMsg.content) + 4 : 0) +
    (modeSteerMsg ? estimateTokens(modeSteerMsg.content) + 4 : 0);
```

- [ ] **Step 7: Emit the steer block and append it last**

After the `if (directiveMsg) { blocks.push(... 'director' ...) }` block (`lib/prompt/build.ts:246-254`), add:

```ts
  if (modeSteerMsg) {
    blocks.push({
      label: 'mode_steer',
      role: modeSteerMsg.role,
      content: modeSteerMsg.content,
      tokens: estimateTokens(modeSteerMsg.content),
      ephemeral: true,
    });
  }
```

Update the final `messages` assembly (`lib/prompt/build.ts:256-261`) to append the steer after the directive:

```ts
  const messages = mergeAdjacentRoles([
    ...preMessages,
    ...finalHistory,
    ...postMessages,
    ...(directiveMsg ? [directiveMsg] : []),
    ...(modeSteerMsg ? [modeSteerMsg] : []),
  ]);
```

- [ ] **Step 8: Thread `genMode`/`oobMode` through `assemblePrompt`**

In `lib/prompt/assemble.ts`, add `PlayMode` to the type import (`lib/prompt/assemble.ts:2`):

```ts
import type { BuiltPrompt, GenConfig, Message, OobMode, PlayMode } from '../types';
```

Add to `AssembleOptions` (`lib/prompt/assemble.ts:17-21`):

```ts
  genMode?: PlayMode;
```

In the `buildPrompt({ ... })` call (`lib/prompt/assemble.ts:95-116`), add two fields (alongside `authorNoteEnabled`):

```ts
    oobMode,
    genMode: opts.genMode,
```

- [ ] **Step 9: Run tests + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS — three new steer tests pass, existing pass, no type errors.

- [ ] **Step 10: Commit**

```bash
git add lib/prompt/build.ts lib/prompt/assemble.ts test/build-prompt.test.ts
git commit -m "feat(prompt): genMode mode-steer for impersonate and narrator generation"
```

---

### Task 3: Frame standing directives, normalize narration for backend safety

**Files:**
- Modify: `lib/prompt/build.ts` (add `standingDirectiveTemplate`, rewrite `historyToProvider`)
- Test: `test/build-prompt.test.ts`

**Interfaces:**
- Consumes: `Message.type` (`'chat' | 'directive' | 'narration'`), `m()`, `currentContent()`.
- Produces: history mapping where `type:'directive'` → framed OOC system turn, `type:'narration'` → assistant turn (any stored role), `type:'chat'` → unchanged.

- [ ] **Step 1: Write the failing tests**

Add to `test/build-prompt.test.ts`:

```ts
test('pinned standing directive is framed as an out-of-character note, not raw', () => {
  const built = buildPrompt({
    ...base,
    messages: [
      msg('m1', 'user', 'hi', 1),
      { ...msg('d1', 'system', 'Keep the pacing slow.', 2), type: 'directive', pinned_directive: 1 },
    ],
  });
  const framed = built.messages.find((pm) => pm.content.includes('Keep the pacing slow'))!;
  assert.match(framed.content, /Director note/);
  assert.match(framed.content, /out of character/i);
});

test('narration history is re-injected as an assistant turn, never a lone system turn', () => {
  const built = buildPrompt({
    ...base,
    messages: [
      msg('m1', 'user', 'hi', 1),
      { ...msg('n1', 'system', 'The rain intensifies.', 2), type: 'narration' },
      msg('m2', 'assistant', 'Alice looks up.', 3),
    ],
  });
  const narr = built.messages.find((pm) => pm.content.includes('rain intensifies'))!;
  assert.equal(narr.role, 'assistant');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — directive content is raw (no "Director note"); narration turn role is `system`.

- [ ] **Step 3: Add the framing helper + rewrite `historyToProvider`**

Add near the other template helpers in `lib/prompt/build.ts` (after `authorNoteTemplate`, `lib/prompt/build.ts:83`):

```ts
function standingDirectiveTemplate(content: string, ctx: MacroContext): string {
  return `[Director note — out of character, not dialogue. ${content} Stay in character as ${ctx.char}.]`;
}
```

Replace `historyToProvider` (`lib/prompt/build.ts:94-96`):

```ts
function historyToProvider(msg: Message, ctx: MacroContext): ProviderMessage {
  const content = m(currentContent(msg), ctx);
  if (msg.type === 'directive') return { role: 'system', content: standingDirectiveTemplate(content, ctx) };
  if (msg.type === 'narration') return { role: 'assistant', content };
  return { role: msg.role, content };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompt/build.ts test/build-prompt.test.ts
git commit -m "feat(prompt): frame standing directives, normalize narration to assistant turns"
```

---

### Task 4: Nullable finalize + per-mode generation finalize in `/api/chat`

**Files:**
- Create: `lib/api/finalize.ts`
- Modify: `lib/api/stream.ts:7-17,69,87-91` (nullable `FinalizeResult`)
- Modify: `lib/api/schemas.ts:108-116` (`genMode` on `chatMessageSchema`)
- Modify: `app/api/chat/route.ts` (per-mode finalize)
- Test: `test/generation-finalize.test.ts`

**Interfaces:**
- Produces: `generationFinalizeInput(genMode: PlayMode, chatId: string, fullText: string): MessageInput | null` — returns `null` for `as_user` (impersonation, persist nothing), otherwise the `createMessage` input (assistant/chat, or assistant/narration for narrator). `FinalizeResult` in `lib/api/stream.ts` becomes `FinalizeResult | null` from `finalize`.
- Consumes: `MessageInput` type (`lib/db/repos/messages.ts:74`), `createMessage` (`lib/db/repos/messages.ts:85`), `chatMessageSchema`.

- [ ] **Step 1: Write the failing test**

Create `test/generation-finalize.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `lib/api/finalize.ts` does not exist.

- [ ] **Step 3: Create the pure finalize helper**

Create `lib/api/finalize.ts` (no `server-only`; type-only import so tests stay clean):

```ts
import type { MessageInput } from '../db/repos/messages';
import type { PlayMode } from '../types';

export function generationFinalizeInput(
  genMode: PlayMode,
  chatId: string,
  fullText: string,
): MessageInput | null {
  if (genMode === 'as_user') return null; // impersonation streams to the composer, never persisted
  return {
    chat_id: chatId,
    role: 'assistant',
    type: genMode === 'narrator' ? 'narration' : 'chat',
    mode: genMode === 'narrator' ? 'narrator' : null,
    swipes: [fullText],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all three finalize tests).

- [ ] **Step 5: Make `FinalizeResult` nullable in the stream**

In `lib/api/stream.ts`, change the `finalize` signature (`lib/api/stream.ts:16`):

```ts
  finalize: (fullText: string, aborted: boolean) => FinalizeResult | null;
```

Update the error-path finalize (`lib/api/stream.ts:69-70`):

```ts
          const result = opts.finalize(full, true);
          controller.enqueue(sse({ error: message, messageId: result?.messageId }));
```

Update the success finalize (`lib/api/stream.ts:87-90`):

```ts
      const result = opts.finalize(full, aborted);
      controller.enqueue(
        sse({ done: true, aborted, messageId: result?.messageId, swipeIndex: result?.swipeIndex }),
      );
```

- [ ] **Step 6: Add `genMode` to `chatMessageSchema`**

In `lib/api/schemas.ts`, add to `chatMessageSchema` (`lib/api/schemas.ts:108-116`), after the `mode` field:

```ts
  genMode: playModeSchema.optional(),
```

(`playModeSchema` already exists at `lib/api/schemas.ts:5`.)

- [ ] **Step 7: Branch the route finalize per mode**

Rewrite `app/api/chat/route.ts` `POST` body-to-stream section. Add the import at the top:

```ts
import { generationFinalizeInput } from '@/lib/api/finalize';
```

Replace the `try { ... }` block (`app/api/chat/route.ts:33-53`) with:

```ts
  const genMode = body.genMode ?? 'as_char';

  try {
    const assembled = await assemblePrompt(body.chatId, {
      directive: body.directive ?? null,
      genMode,
    });
    return streamChat({
      assembled,
      signal: req.signal,
      finalize: (fullText) => {
        const input = generationFinalizeInput(genMode, body.chatId, fullText);
        if (!input) return null;
        const msg = createMessage(input);
        return { messageId: msg.id, swipeIndex: 0 };
      },
    });
  } catch (e) {
    return handleError(e);
  }
```

- [ ] **Step 8: Run tests + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 9: Commit**

```bash
git add lib/api/finalize.ts lib/api/stream.ts lib/api/schemas.ts app/api/chat/route.ts test/generation-finalize.test.ts
git commit -m "feat(chat): per-mode generation finalize (impersonate persists nothing, narrator saves narration)"
```

---

### Task 5: Client wiring — impersonate to draft + generate in active mode

**Files:**
- Modify: `lib/store/stream.ts:5` (`StreamKind`), `lib/store/stream.ts:48-53` (`streamStatus`)
- Modify: `lib/client/useGenerate.ts` (return streamed text; add `generateScene`, `impersonate`)
- Modify: `components/chat/ChatView.tsx` (wire generate-in-mode + impersonate→draft, store manual narration as assistant)
- Modify: `components/chat/Composer.tsx` (impersonate button in `as_user` mode)

**Interfaces:**
- Consumes: `run(url, body, chatId, kind, targetMessageId, seed)` (existing). `/api/chat` accepts `{ chatId, genMode, directive }`.
- Produces:
  - `useGenerate().generateScene(chatId: string, genMode: PlayMode, directive?: {content: string; strong?: boolean} | null)` → runs a generation in the given mode.
  - `useGenerate().impersonate(chatId: string)` → `Promise<{ aborted: boolean; error: string | null; text: string }>`; streams as `as_user`, persists nothing, returns the drafted text.
  - `run(...)` now resolves to `{ aborted, error, messageId?, text }` (adds `text`).

- [ ] **Step 1: Add the `impersonate` stream kind + status**

In `lib/store/stream.ts:5`:

```ts
export type StreamKind = 'new' | 'regen' | 'continue' | 'impersonate';
```

In `streamStatus` (`lib/store/stream.ts:48-53`), add an impersonate label:

```ts
export function streamStatus(phase: StreamPhase, kind: StreamKind | null): string {
  if (phase === 'loading') return 'Loading';
  if (phase === 'streaming')
    return kind === 'regen'
      ? 'Regenerating'
      : kind === 'continue'
        ? 'Continuing'
        : kind === 'impersonate'
          ? 'Impersonating'
          : 'Generating';
  return '';
}
```

(No change needed in `MessageList.tsx` — `showStreamingBubble` is gated to `kind === 'new'`, so impersonation shows no phantom bubble.)

- [ ] **Step 2: Return streamed text from `run`; add `generateScene` + `impersonate`**

In `lib/client/useGenerate.ts`, capture the final text before `finish()` clears it. Replace the `run` callback body tail (`lib/client/useGenerate.ts:84-95`):

```ts
      const result = await drive(url, body, controller, (d) => useStream.getState().append(d));
      const text = useStream.getState().text;

      if (result.error) {
        pushToast(result.error, 'error');
        useStream.getState().fail(result.error);
      }
      useStream.getState().finish();
      qc.invalidateQueries({ queryKey: qk.messages(chatId) });
      qc.invalidateQueries({ queryKey: qk.chat(chatId) });
      qc.invalidateQueries({ queryKey: qk.chats });
      return { ...result, text };
```

Replace `generate` (`lib/client/useGenerate.ts:105-109`) with `generateScene`, and add `impersonate` after `continueMessage`:

```ts
  const generateScene = useCallback(
    (
      chatId: string,
      genMode: PlayMode,
      directive?: { content: string; strong?: boolean } | null,
    ) => run('/api/chat', { chatId, genMode, directive: directive ?? null }, chatId, 'new', null),
    [run],
  );

  const impersonate = useCallback(
    (chatId: string) => run('/api/chat', { chatId, genMode: 'as_user' }, chatId, 'impersonate', null),
    [run],
  );
```

Update the return statement (`lib/client/useGenerate.ts:125`):

```ts
  return { send, generateScene, impersonate, regenerate, continueMessage, stop, stream };
```

- [ ] **Step 3: Wire ChatView — generate in active mode, impersonate to draft, narration as assistant**

In `components/chat/ChatView.tsx`:

Pull the active mode and the new fns (`components/chat/ChatView.tsx:18`, add the `useUi` playMode selector near the other `useUi` calls):

```ts
  const { send, generateScene, impersonate, regenerate, continueMessage, stop } = useGenerate();
  const playMode = useUi((s) => s.playMode);
```

In `onSubmit`, change the narrator/character manual-add branch to store narration as `assistant` (`components/chat/ChatView.tsx:62-70`):

```ts
      } else {
        const isNarration = mode === 'narrator';
        await api.apiSend(`/api/chats/${chatId}/messages`, 'POST', {
          role: 'assistant',
          type: isNarration ? 'narration' : 'chat',
          mode,
          content,
        });
        invalidate([qk.messages(chatId), qk.chat(chatId)]);
      }
```

Replace `onContinueScene` (`components/chat/ChatView.tsx:76-85`) to generate in the active mode:

```ts
  const onContinueScene = useCallback(
    (directive?: { content: string; strong?: boolean }) => {
      if (!chat?.model_id) {
        pushToast('Pick a model first (top-left).', 'error');
        return;
      }
      const genMode = playMode === 'as_user' ? 'as_char' : playMode;
      void generateScene(chatId, genMode, directive ?? null);
    },
    [chat, chatId, pushToast, generateScene, playMode],
  );

  const onImpersonate = useCallback(async () => {
    if (!chat?.model_id) {
      pushToast('Pick a model first (top-left).', 'error');
      return;
    }
    const r = await impersonate(chatId);
    if (!r.error && !r.aborted && r.text.trim()) setDraft(r.text.trim());
  }, [chat, chatId, pushToast, impersonate]);
```

(Note: `onContinueScene` maps `as_user → as_char` because the "generate" button in a non-user mode means "advance the scene as the character or narrator"; impersonation has its own button.)

Pass `onImpersonate` to the Composer (`components/chat/ChatView.tsx:187-196`), add the prop:

```tsx
      <Composer
        chatId={chatId}
        draft={draft}
        setDraft={setDraft}
        onSubmit={onSubmit}
        onGenerate={onContinueScene}
        onImpersonate={onImpersonate}
        running={stream.running && stream.chatId === chatId}
        status={stream.chatId === chatId ? streamStatus(stream.phase, stream.kind) : ''}
        onStop={stop}
      />
```

- [ ] **Step 4: Composer — impersonate button in `as_user` mode**

In `components/chat/Composer.tsx`, add `Wand2` to the lucide import (`components/chat/Composer.tsx:5`):

```ts
import { ArrowUp, Square, Play, Plus, Wand2 } from 'lucide-react';
```

Add `onImpersonate` to `Props` (`components/chat/Composer.tsx:15-24`):

```ts
  onImpersonate: () => void;
```

Destructure it (`components/chat/Composer.tsx:38`):

```ts
export function Composer({ chatId, draft, setDraft, onSubmit, onGenerate, onImpersonate, running, status, onStop }: Props) {
```

In the `as_user` send branch (`components/chat/Composer.tsx:109-117`), add an impersonate button before the send button:

```tsx
              ) : mode === 'as_user' ? (
                <div className="flex items-center gap-1">
                  <button
                    className="btn btn-ghost btn-sm btn-circle text-[var(--fg-muted)]"
                    onClick={onImpersonate}
                    aria-label="Impersonate"
                    title="Let the AI draft your next message (fills the box)"
                  >
                    <Wand2 size={16} />
                  </button>
                  <button
                    className="btn btn-circle btn-sm btn-primary"
                    onClick={submit}
                    disabled={!draft.trim()}
                    aria-label="Send"
                  >
                    <ArrowUp size={16} />
                  </button>
                </div>
              ) : (
```

- [ ] **Step 5: Typecheck + manual smoke**

Run: `npm run typecheck`
Expected: PASS.

Manual smoke (dev server): in `as_user` mode click the wand → AI text fills the composer draft, no new bubble, nothing persisted. In `narrator` mode click Play → a centered narration message appears. In `as_char` mode click Play → a character reply appears.

- [ ] **Step 6: Commit**

```bash
git add lib/store/stream.ts lib/client/useGenerate.ts components/chat/ChatView.tsx components/chat/Composer.tsx
git commit -m "feat(chat): impersonate-to-draft, generate in active play mode, narration as assistant"
```

---

### Task 6: Mode-aware, grounded Suggestions

**Files:**
- Create: `lib/prompt/suggest.ts` (pure prompt builder)
- Modify: `lib/api/schemas.ts:128-130` (`mode` on `suggestSchema`)
- Modify: `app/api/suggest/route.ts` (gather author's note + lorebook; use builder; accept mode)
- Modify: `components/director/Suggestions.tsx` (send active mode)
- Test: `test/suggest-prompt.test.ts`

**Interfaces:**
- Produces: `buildSuggestMessages(mode: PlayMode, c: SuggestContext): { system: string; user: string }` where
  `SuggestContext = { charName: string; charDescription: string; charPersonality: string; charScenario: string; personaName: string; personaDescription: string; authorNote: string; lorebook: string[]; transcript: string }`.
- Consumes: `entriesForCharacter` (`lib/db/repos/lorebooks.ts`), `scanLorebook` (`lib/prompt/lorebook.ts`), `estimateTokens` (`lib/tokenizer.ts`), `resolveMacros`.

- [ ] **Step 1: Write the failing test**

Create `test/suggest-prompt.test.ts`:

```ts
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

test('as_user asks for player actions', () => {
  const { system, user } = buildSuggestMessages('as_user', ctx);
  assert.match(system, /player/i);
  assert.match(user, /Keep it tense/); // author's note grounded
  assert.match(user, /forbidden after dark/); // lorebook grounded
});

test('as_char asks for the character\'s own lines', () => {
  const { system } = buildSuggestMessages('as_char', ctx);
  assert.match(system, /Alice/);
  assert.match(system, /say|do/i);
});

test('narrator asks for scene beats', () => {
  const { system } = buildSuggestMessages('narrator', ctx);
  assert.match(system, /scene|narrat/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `lib/prompt/suggest.ts` does not exist.

- [ ] **Step 3: Create the pure suggestion prompt builder**

Create `lib/prompt/suggest.ts`:

```ts
import type { PlayMode } from '../types';

export interface SuggestContext {
  charName: string;
  charDescription: string;
  charPersonality: string;
  charScenario: string;
  personaName: string;
  personaDescription: string;
  authorNote: string;
  lorebook: string[];
  transcript: string;
}

const SYSTEM: Record<PlayMode, string> = {
  as_user:
    "You suggest what the player could do or say next in a roleplay. " +
    "Write 3-4 options from the player's point of view (\"you\"), each at most 15 words.",
  as_char:
    'You suggest lines or actions the character could take next in a roleplay. ' +
    'Write 3-4 options in the character\'s voice, each at most 15 words.',
  narrator:
    'You suggest what could happen next in the scene as neutral narration. ' +
    'Write 3-4 short scene beats, each at most 15 words.',
};

export function buildSuggestMessages(
  mode: PlayMode,
  c: SuggestContext,
): { system: string; user: string } {
  const system =
    SYSTEM[mode] +
    ' Return ONLY a JSON array of strings. No prose, no explanation.';
  const user = [
    `Character: ${c.charName}`,
    c.charDescription && `Description: ${c.charDescription}`,
    c.charPersonality && `Personality: ${c.charPersonality}`,
    c.charScenario && `Scenario: ${c.charScenario}`,
    `Player persona: ${c.personaName}${c.personaDescription ? ` — ${c.personaDescription}` : ''}`,
    c.authorNote && `Author's note (steer): ${c.authorNote}`,
    c.lorebook.length ? `World info:\n${c.lorebook.join('\n')}` : '',
    `\nConversation so far:\n${c.transcript}`,
    '\nReturn the JSON array now.',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Add `mode` to `suggestSchema`**

In `lib/api/schemas.ts`, update `suggestSchema` (`lib/api/schemas.ts:128-130`):

```ts
export const suggestSchema = z.object({
  chatId: z.string().min(1),
  mode: playModeSchema.optional(),
});
```

- [ ] **Step 6: Ground the route in author's note + lorebook, use the builder**

Rewrite `app/api/suggest/route.ts`. Update imports (add lorebook + tokenizer + builder):

```ts
import { getChat } from '@/lib/db/repos/chats';
import { getCharacter } from '@/lib/db/repos/characters';
import { getPersona, getDefaultPersona } from '@/lib/db/repos/personas';
import { listMessages, currentContent } from '@/lib/db/repos/messages';
import { getConnection, getDecryptedKey } from '@/lib/db/repos/connections';
import { getBehavior } from '@/lib/db/repos/settings';
import { entriesForCharacter } from '@/lib/db/repos/lorebooks';
import { getProvider } from '@/lib/providers';
import { resolveMacros, makeMacroContext } from '@/lib/prompt/macros';
import { scanLorebook } from '@/lib/prompt/lorebook';
import { buildSuggestMessages } from '@/lib/prompt/suggest';
import { estimateTokens } from '@/lib/tokenizer';
import { suggestSchema } from '@/lib/api/schemas';
import { json, apiError, handleError } from '@/lib/api/respond';
```

Replace the context-building + call section (`app/api/suggest/route.ts:33-78`) with:

```ts
  const character = chat.character_id ? getCharacter(chat.character_id) : null;
  const persona = chat.persona_id ? getPersona(chat.persona_id) : getDefaultPersona();
  const ctx = makeMacroContext(character?.name ?? 'Character', persona?.name ?? 'User', persona?.description ?? '');
  const mm = (s: string | null | undefined) => resolveMacros(s ?? '', ctx);

  const msgs = listMessages(body.chatId).filter((m) => m.type !== 'directive' || m.pinned_directive === 1);
  const transcript = msgs
    .slice(-24)
    .map((m) =>
      m.type === 'directive'
        ? `[Director instruction: ${mm(currentContent(m))}]`
        : `${m.role}: ${mm(currentContent(m))}`,
    )
    .join('\n');

  const historyText = msgs.map((m) => currentContent(m));
  const lore = scanLorebook(entriesForCharacter(chat.character_id), historyText, 512, estimateTokens);

  const { system, user } = buildSuggestMessages(body.mode ?? 'as_user', {
    charName: character?.name ?? 'Unknown',
    charDescription: mm(character?.description),
    charPersonality: mm(character?.personality),
    charScenario: mm(character?.scenario),
    personaName: persona?.name ?? 'User',
    personaDescription: mm(persona?.description),
    authorNote: chat.author_note_enabled === 1 ? mm(chat.author_note) : '',
    lorebook: lore.active.map((e) => mm(e.content)),
    transcript,
  });

  const provider = getProvider(connection.type, connection.base_url, getDecryptedKey(connection.id));
  try {
    let full = '';
    for await (const chunk of provider.chat({
      model: modelId,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      config: { temperature: 0.8, max_tokens: 200 },
      signal: req.signal,
    })) {
      full += chunk.delta;
      if (chunk.done) break;
    }
    return json({ suggestions: parseSuggestions(full) });
  } catch (e) {
    return handleError(e);
  }
```

Leave `parseSuggestions` (`app/api/suggest/route.ts:84-99`) unchanged.

Confirm `entriesForCharacter` accepts `string | null` — check `lib/db/repos/lorebooks.ts`; it is called with `chat.character_id` (nullable) exactly as `entriesForCharacter(chat.character_id)` in `lib/prompt/assemble.ts:64`, so this matches existing usage.

- [ ] **Step 7: Send the active mode from the Suggestions component**

In `components/director/Suggestions.tsx`, read the play mode and pass it. Add the import + selector and update the POST body (`components/director/Suggestions.tsx:19-29`):

```tsx
  const mode = useUi((s) => s.playMode);
  // ...
  const load = async () => {
    setLoading(true);
    try {
      const res = await api.apiSend<{ suggestions: string[] }>('/api/suggest', 'POST', { chatId, mode });
      setSuggestions(res.suggestions);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Could not get suggestions', 'error');
    } finally {
      setLoading(false);
    }
  };
```

(`useUi` is already imported at `components/director/Suggestions.tsx:6`.)

- [ ] **Step 8: Run tests + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/prompt/suggest.ts lib/api/schemas.ts app/api/suggest/route.ts components/director/Suggestions.tsx test/suggest-prompt.test.ts
git commit -m "feat(suggest): mode-aware suggestions grounded in author's note and lorebook"
```

---

## Final verification

- [ ] Run full suite: `npm test` — all green.
- [ ] `npm run typecheck` — clean.
- [ ] `npm run lint` — clean.
- [ ] Manual pass in dev (`npm run dev`): impersonate fills draft (nothing persisted); narrator Play produces a narration card; as_char Play produces a character reply; a pinned director note steers without appearing as dialogue; a character with its own system prompt still obeys the global rules; Suggestions change shape with the active chip.

## Notes / deliberate simplifications

- **Narration frame:** narration is re-injected role-normalized to `assistant` with content unchanged (no per-turn "[Narration]" prefix). The generation-time narrator steer already defines narration; per-turn markers would waste tokens. `// ponytail:` role-normalize only; add a marker if narration voice bleeds into character voice.
- **Standing directive role:** kept `system` (framed), per spec — not converted to a user turn. `mergeAdjacentRoles` keeps alternation valid. Revisit only if a strict backend rejects mid-history system turns for directives specifically.
- **Suggestions grounding:** the route gathers author's note + lorebook inline rather than extracting a shared context module from `assemblePrompt`. Smaller, lower-risk diff than refactoring the hot generation path. Extract later if a third consumer appears.
