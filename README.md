<div align="center">

# GoyLLM

**A self-hosted, local-first LLM roleplay client.**
Run your own chat UI, plug in any OpenAI-compatible provider, and keep every byte on your machine.

![](https://i.imgur.com/AIWonc6.jpeg)

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
![Next.js 15](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React 19](https://img.shields.io/badge/React-19-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-local--first-003b57?logo=sqlite)

</div>

> [!NOTE]
> **Hobby project.** Built for fun in spare time. No guarantees, no roadmap, no support commitment — don't expect production polish or timely fixes. Use it as-is, PRs welcome but not promised a review.

---

## Contents

- [Why GoyLLM](#why-goyllm)
- [Features](#features)
- [Quick start](#quick-start)
- [Connect a provider](#connect-a-provider)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Development](#development)
- [Architecture](#architecture)
- [Credits](#credits)
- [License](#license)

## Why GoyLLM

- **Local-first.** All chats, characters, and settings live in a single local SQLite database. No account, no cloud, no telemetry.
- **Your keys stay yours.** API keys are encrypted at rest (AES-256-GCM) and **never** sent to the browser — `GET /api/connections` returns masked keys only.
- **Provider-agnostic.** OpenRouter, Ollama, LM Studio, or any OpenAI-compatible endpoint. Models are fetched automatically — you never type a model name.
- **Built for roleplay.** SillyTavern card interop, play modes, a director tool, lorebooks, and a fully inspectable prompt builder.

> [!WARNING]
> **Not deployable to serverless.** SQLite needs a persistent filesystem; on Vercel/Netlify the filesystem is ephemeral and the DB is wiped on every cold start. Every DB route runs on the Node runtime (`export const runtime = 'nodejs'`), never edge. Deploy with `next start` on your own machine or Docker with a mounted volume.

## Features

**Characters & personas**
- Import/export **SillyTavern V2/V3** cards — PNG `tEXt` chunks (`chara`/`ccv3`) and JSON. Round-trip is lossless, including `extensions`.
- User personas with per-chat overrides.

**Chat & roleplay**
- **Play modes** — As User (generates), As Character / Narrator ("Add", then "Continue").
- **Director tool** — out-of-character instructions injected as an ephemeral system directive at the end of context, never stored as your turn.
- **Full chat control** — edit, delete, regenerate, swipe, branch, continue, undo.

**Prompt engineering**
- **Prompt builder** with configurable block order, a token-budget meter, and a **Prompt Inspector** showing the exact payload sent to the model.
- **Author's Note** with depth injection.
- **Lorebook** — keyword-triggered context entries.
- **RAG** (optional, off by default) — semantic retrieval via `sqlite-vec`.

**History & data**
- **FTS5 full-text search**, auto-title, pin/archive, soft-delete trash.
- Full DB **backup/restore** from the settings panel.

## Quick start

**Requirements:** Node.js 20+ (Docker image uses Node 22) and npm.

```bash
git clone https://github.com/rafi441/goy-llm.git
cd goy-llm
cp .env.example .env
# edit .env and set GOYLLM_SECRET to a long random string (min 16 chars)
npm install
npm run dev
```

Open **http://localhost:3000** and add a provider under **Settings → Connections**.

## Connect a provider

| Provider          | Base URL (default)              | API key    |
| ----------------- | ------------------------------- | ---------- |
| OpenRouter        | `https://openrouter.ai/api/v1`  | required   |
| Ollama            | `http://localhost:11434`        | —          |
| LM Studio         | `http://localhost:1234/v1`      | —          |
| OpenAI-compatible | your endpoint (`.../v1`)        | optional   |

Once connected, models are **fetched automatically** — pick one from the header dropdown.

## Configuration

Set via `.env` (see [`.env.example`](.env.example)):

| Variable          | Required | Purpose                                                                 |
| ----------------- | -------- | ----------------------------------------------------------------------- |
| `GOYLLM_SECRET`   | ✅       | Key material for AES-256-GCM encryption of API keys. Min 16 chars.      |
| `GOYLLM_DATA_DIR` | —        | Where the SQLite DB and avatars live. Default `./data`.                 |

## Deployment

### Production build

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t goyllm .
docker run -p 3000:3000 \
  -e GOYLLM_SECRET=your-long-secret \
  -v goyllm-data:/app/data \
  goyllm
```

> [!IMPORTANT]
> The `-v` volume is **required** — without it the database does not survive container restarts.

## Development

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 · daisyUI v5 · lucide-react · better-sqlite3 (WAL, FTS5, sqlite-vec) · Zustand · TanStack Query.

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm test           # node --test
npm run db:reset   # wipe and recreate the local DB
```

Tests cover the two most critical guarantees: `buildPrompt()` behavior (director placement, truncation, macros, depth injection) and lossless character-card round-trips.

## Architecture

- **Provider adapters** implement one interface (`listModels`, `chat`, `embed`, `capabilities`). Adding a provider is one new file in `lib/providers/` — no UI changes.
- **`buildPrompt()`** in `lib/prompt/build.ts` is a pure function — fully unit-testable without a DB or network.
- **Server-only boundary** — every file touching `better-sqlite3` or API keys is marked `import 'server-only'`, so secrets never leak into a client bundle.

## Credits

- Character-card interop follows the [SillyTavern](https://github.com/SillyTavern/SillyTavern) V2/V3 card spec.
- Built on the open-source stack listed above — thanks to their maintainers.

## License

Licensed under the [GNU GPL v3.0](LICENSE).
