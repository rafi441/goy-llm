# Roleplay System Overhaul — Design

**Date:** 2026-07-16
**Status:** Approved (design), pending implementation plan
**Scope:** Director, Suggestions, Play-as-role modes, system-prompt layering, narration backend-safety

## Problem

The three roleplay-steering systems are shallow or broken:

1. **Play-as-role modes don't drive generation.** `as_user` / `as_char` / `narrator` only change what a manual "Add" stores. `assemblePrompt` never receives the mode, so the AI *always* generates as the character regardless of the selected chip (`app/api/chat/route.ts:22-31`). There is no **Impersonate** (AI writes the player's line), and the Narrator can never generate — it is manual-only.
2. **Director pinned directives are injected raw.** Ephemeral directives get proper OOC framing (`lib/prompt/build.ts:49-61`), but pinned/standing directives are stored as `role:system` messages and dropped into history unframed (`lib/prompt/build.ts:94-96`) — the model reads them as narration/dialogue.
3. **Suggestions are shallow.** `/api/suggest` rebuilds context by hand (`app/api/suggest/route.ts:38-62`), ignoring author's note, lorebook, and the system/character prompt, and always assumes player-POV regardless of mode.
4. **Global system prompt is silently dropped.** When a character card has its own `system_prompt`, it *replaces* the global one (`lib/prompt/build.ts:114-117`). Universal rules ("never break character") vanish for such characters.
5. **Narration breaks strict backends.** Narration is stored `role:system` and interleaved mid-history; a lone system turn between user/assistant turns is rejected by strict backends (DeepSeek etc.).

## Decisions (confirmed)

- **Play modes:** full SillyTavern model — each chip changes what the AI generates; manual "Add" retained for all three.
- **System prompt:** global is always the baseline; character `system_prompt` is appended after it.
- **Suggestions:** mode-aware, grounded in the real assembled context.

## Approach

**Thread a single `genMode` field through the existing `assemblePrompt` → `buildPrompt` pipeline**, and branch the finalize step per mode. This reuses assembly, truncation, macro resolution, and streaming untouched. Rejected alternatives: separate per-mode endpoints (duplicates plumbing), and persist-then-reclassify (breaks impersonate-to-draft).

## Design

### 1. `genMode` in the generation pipeline

- `chatMessageSchema` gains `genMode: playModeSchema.optional()` (defaults to `as_char` semantics for generation). The existing `mode` field stays for the manual-add path.
- `AssembleOptions` gains `genMode?: PlayMode`. `assemblePrompt` passes it to `buildPrompt`.
- `BuildPromptArgs` gains `genMode?: PlayMode`. `buildPrompt` appends **one ephemeral mode-steer** — a final system/user turn built by the same mechanism as the director steer, so existing backend role rules (end-on-user-turn, no consecutive same-role) already apply. The steer text (macro-resolved):
  - `as_char` (default): no steer, or a minimal "continue as {{char}}" — current behavior preserved.
  - `as_user` (impersonate): "Write {{user}}'s next message only — first person as {{user}}, their words and actions, in the established style. Do not write, narrate, or speak for {{char}}. Stop before {{char}} responds."
  - `narrator`: "You are the Narrator. Write neutral third-person narration that advances the scene. Do not voice {{char}} or {{user}} dialogue; describe only."
- The mode-steer is ephemeral (never persisted), mirroring the director directive.

### 2. Per-mode finalize in `/api/chat`

`FinalizeResult` becomes nullable — `finalize` may return `null` to mean "persist nothing" (`lib/api/stream.ts`). The `done` SSE frame then carries no `messageId`/`swipeIndex`, and the empty/aborted branches tolerate a null result.

- `as_char` → `createMessage` assistant/chat (unchanged).
- `narrator` → `createMessage` assistant role, `type:'narration'`, `mode:'narrator'`. (Assistant role, not system — see §6.)
- `as_user` (impersonate) → **return `null`**; nothing persisted. The streamed text is the deliverable.

### 3. Impersonate → composer draft (client)

- `StreamKind` gains `'impersonate'`. `lib/store/stream.ts` unchanged structurally (it already buffers `text`); the consumer reads the final buffered text.
- `useGenerate` gains `impersonate(chatId)` → `run('/api/chat', { chatId, genMode: 'as_user' }, chatId, 'impersonate', null)`. On finish, when `kind === 'impersonate'`, it invokes an `onResult(text)` callback with the accumulated stream text **before** `finish()` clears it, and **skips** `qk.messages` invalidation (nothing persisted).
- `ChatView` wires `impersonate` so the result lands in the composer `draft` (user edits, then sends normally). `streamStatus` gains an "Impersonating" label.

### 4. System-prompt layering

`lib/prompt/build.ts` `systemContent`:

```
const parts = [m(args.systemPrompt, ctx), char ? m(char.system_prompt, ctx) : '']
  .map(s => s.trim()).filter(Boolean);
const systemContent = parts.join('\n\n');
```

Global always present; character prompt appended when non-empty. Both empty → empty block (dropped as today).

### 5. Director — framed standing directives

- In `buildPrompt`, pinned directives currently pass through `historyToProvider` raw. Instead, render any `type:'directive'` history message through an OOC director frame (reuse/extract the `directorTemplate` framing or an `authorNoteTemplate`-style wrapper) so standing instructions read as out-of-character guidance, consistent with ephemeral directives.
- Position: keep chronological placement in history (minimal change); framing is the fix. Depth/position control is out of scope.

### 6. Narration backend-safety

- New narration is persisted `role:'assistant'`, `type:'narration'` (§2), so it participates in normal user/assistant alternation.
- On re-injection in `buildPrompt`, narration content is wrapped in a light neutral frame (e.g. prefix marker) so the model distinguishes narration from the character's own voice, while `mergeAdjacentRoles` keeps role alternation valid.
- Existing narration rows stored `role:'system'`: `historyToProvider` maps any `type:'narration'` history message to `role:'assistant'` at build time regardless of stored role, so old rows also become backend-safe without a migration.
- Display (`MessageItem` / `MessageList`) keys narration styling off `type:'narration'`, which is unchanged — no visual regression.

### 7. Suggestions — mode-aware, grounded

- Extract the context-gathering half of `assemblePrompt` (character, persona, author's note, lorebook, system prompt, recent history, macros) into a shared helper both `assemblePrompt` and `/api/suggest` use — so suggestions see the same grounding as generation. (Minimal extraction; no behavior change to `assemblePrompt`.)
- `suggestSchema` gains `mode: playModeSchema.optional()`. The suggestion ask adapts:
  - `as_user`: 3–4 short player actions/lines ("you could…").
  - `as_char`: 3–4 lines {{char}} might say/do next.
  - `narrator`: 3–4 scene beats that could happen next.
- Utility model if set, else chat model (unchanged). Parsing (`parseSuggestions`) unchanged.

## Components & boundaries

| Unit | Change | Depends on |
|------|--------|-----------|
| `lib/prompt/build.ts` | `genMode` steer, system-prompt layering, directive framing, narration wrap/role-normalize | types, macros |
| `lib/prompt/assemble.ts` | pass `genMode`; extract shared context helper | build, repos |
| `lib/api/stream.ts` | nullable `FinalizeResult` | providers |
| `app/api/chat/route.ts` | `genMode` in, per-mode finalize | assemble, stream, messages |
| `app/api/suggest/route.ts` | shared context helper, `mode`-aware ask | shared helper |
| `lib/api/schemas.ts` | `genMode` on chat, `mode` on suggest | zod |
| `lib/client/useGenerate.ts` | `impersonate()`, `'impersonate'` kind | store/stream |
| `lib/store/stream.ts` | `'impersonate'` in `StreamKind`, status label | — |
| `components/chat/ChatView.tsx` | wire impersonate → draft; mode → genMode on generate | useGenerate |
| `components/chat/Composer.tsx` / `ModeChips.tsx` | impersonate affordance per mode | — |
| `components/director/Suggestions.tsx` | send active mode | ui store |

## Error handling

- Impersonate/narrator empty response → existing empty-response SSE error path (finalize null tolerated).
- Missing utility+chat model for suggestions → existing 400 (unchanged).
- Abort mid-impersonate → nothing persisted (null finalize); draft left as whatever streamed, user decides.

## Testing (node:test, matching `test/build-prompt.test.ts`)

1. `genMode:'as_user'` steer present and instructs writing as {{user}}, not {{char}}; ends on a model-answerable turn.
2. `genMode:'narrator'` steer instructs neutral narration; no dialogue directive.
3. `genMode:'as_char'` (or unset) ≈ current output (no regression).
4. System-prompt layering: global-only, char-only, both (global first + char appended), neither.
5. Pinned directive rendered with OOC framing, not raw.
6. Narration history normalized to assistant role; no consecutive same-role in final messages (strict-backend test extended).
7. Suggestions ask shape switches per `mode` (light unit test on the prompt builder, not a live call).

## Out of scope

Lorebook features, RAG changes, group chat, streaming-UI redesign, director depth/position control, per-character override toggle.
