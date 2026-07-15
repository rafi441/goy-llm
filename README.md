# GoyLLM

Self-hosted LLM roleplay client — a ChatGPT-like UI you run yourself. Local-first: all data lives in a local SQLite database. No account, no cloud, no telemetry.

## ⚠️ Cannot be deployed to serverless

SQLite needs a **persistent filesystem**. On Vercel/Netlify serverless the filesystem is ephemeral and the database is wiped on every cold start. Every DB route runs on the Node runtime (`export const runtime = 'nodejs'`), never edge.

**Deploy target:** `next start` on your own machine, or Docker with a mounted volume.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · daisyUI v5 · lucide-react · better-sqlite3 (WAL, FTS5, sqlite-vec) · Zustand · TanStack Query.

## Quick start

```bash
git clone https://github.com/rafi441/goy-llm.git
cd goy-llm
cp .env.example .env
# edit .env and set GOYLLM_SECRET to a long random string
npm install
npm run dev
```

Open http://localhost:3000, open **Settings → Connections**, and add a provider:

| Provider          | Base URL (default)              | API key         |
| ----------------- | ------------------------------- | --------------- |
| OpenRouter        | `https://openrouter.ai/api/v1`  | required        |
| Ollama            | `http://localhost:11434`        | —               |
| LM Studio         | `http://localhost:1234/v1`      | —               |
| OpenAI-compatible | your endpoint (`.../v1`)        | optional        |

Models are **fetched automatically** — you never type a model name. Pick one from the header dropdown.

## Environment

| Variable            | Purpose                                                        |
| ------------------- | ------------------------------------------------------------- |
| `GOYLLM_SECRET`     | Required. Key material for AES-256-GCM encryption of API keys. Min 16 chars. |
| `GOYLLM_DATA_DIR`   | Where the SQLite DB and avatars live. Default `./data`.       |

API keys are encrypted at rest and **never** sent to the browser — `GET /api/connections` always returns masked keys. There is no `NEXT_PUBLIC_*` for secrets.

## Production

```bash
npm run build
npm start
```

## Docker

```bash
docker build -t goyllm .
docker run -p 3000:3000 -e GOYLLM_SECRET=your-long-secret -v goyllm-data:/app/data goyllm
```

The `-v` volume is required — without it the database does not survive container restarts.

## Features

- **Character cards** — import/export SillyTavern V2/V3 (PNG `tEXt` chunks `chara`/`ccv3` + JSON). Round-trip is lossless, including `extensions`.
- **Play modes** — As User (generates), As Character / Narrator ("Add", then "Continue").
- **Director tool** — out-of-character instructions injected as an ephemeral system directive at the end of context, never stored as your turn.
- **Prompt builder** — configurable block order, token budget meter, and a Prompt Inspector showing the exact payload.
- **Chat control** — edit, delete, regenerate, swipe, branch, continue, undo.
- **Author's Note** with depth injection, lorebook (keyword-triggered), and optional RAG (sqlite-vec, off by default).
- **History** — FTS5 search, auto-title, pin/archive, soft-delete trash, full DB backup/restore.

## Tests

```bash
npm test
```

Covers the two most critical guarantees: `buildPrompt()` behavior (director placement, truncation, macros, depth injection) and lossless character-card round-trips.

## Architecture notes

- **Provider adapters** implement one interface (`listModels`, `chat`, `embed`, `capabilities`). Adding a provider is one new file in `lib/providers/`, no UI changes.
- **`buildPrompt()`** in `lib/prompt/build.ts` is a pure function — fully unit-testable without a DB or network.
- Every file touching `better-sqlite3` or API keys is marked `import 'server-only'`.
