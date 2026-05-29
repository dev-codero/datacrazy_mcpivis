# MCP DataCrazy CRM Server

## Project Overview
MCP (Model Context Protocol) server in TypeScript that exposes all 63 endpoints of the DataCrazy CRM API as individual tools, giving AI full autonomy to read and write CRM data.

## Tech Stack
- **Language:** TypeScript
- **Runtime:** Node.js
- **Protocol:** MCP (stdio transport)
- **SDK:** @modelcontextprotocol/sdk
- **Build:** tsup (bundle to single file for npx distribution)

## Architecture
- `src/index.ts` — Entry point, registers all tools on the MCP server
- `src/client.ts` — HTTP client wrapper with auth header and error handling
- `src/config.ts` — Environment variable validation (DATACRAZY_API_TOKEN, DATACRAZY_API_URL, SAFE_MODE)
- `src/safe-mode.ts` — Confirmation logic for destructive operations
- `src/tools/*.ts` — One file per resource module, each exports tool definitions

## API Details
- **Base URL:** `https://api.datacrazy.io/v1`
- **Auth:** Bearer JWT token via `access-token` header
- **Pagination:** `skip`, `take`, `search` query params
- **OpenAPI spec:** `https://api.datacrazy.io/v1/api/openapi/v1/json`

## Conventions
- One tool per API endpoint (63 tools total)
- Tool names use snake_case: `list_leads`, `create_business`, `win_business`
- Each tool file exports a `register*Tools(server, client, config)` function
- Destructive tools (delete_*, lose_business, finish_conversation) respect SAFE_MODE
- All tools include clear descriptions in Portuguese for better AI context

## Safe Mode
- `SAFE_MODE=true` (default): destructive ops require `confirm: true` parameter
- `SAFE_MODE=false`: all operations execute immediately

## Environment Variables
- `DATACRAZY_API_TOKEN` (required) — JWT access token
- `DATACRAZY_API_URL` (optional, default: `https://api.datacrazy.io/v1`)
- `SAFE_MODE` (optional, default: `true`)

## Module Map (tools/)
| File | Tools | Endpoints |
|------|-------|-----------|
| leads.ts | 5 | CRUD leads |
| lead-attachments.ts | 3 | Lead file attachments |
| lead-notes.ts | 4 | Lead comments/annotations |
| lead-history.ts | 1 | Lead history |
| lead-activities.ts | 1 | Lead activities |
| lead-businesses.ts | 1 | Lead businesses |
| businesses.ts | 5 | CRUD businesses/deals |
| business-actions.ts | 4 | Win, lose, move, restore |
| activities.ts | 5 | CRUD activities |
| conversations.ts | 4 | Messages, finish |
| pipelines.ts | 3 | Pipelines + stages |
| tags.ts | 5 | CRUD tags |
| lists.ts | 5 | CRUD lists |
| products.ts | 5 | CRUD products |
| loss-reasons.ts | 5 | CRUD loss reasons |
| attendants.ts | 4 | CRM + Multi attendants |
| instances.ts | 2 | Connection instances |

## CRM Migration (src/migrate/) — planned
One-time DataCrazy→DataCrazy migration script (`npm run migrate`), planned in
`docs/superpowers/`. Reuses `DataCrazyClient` instantiated twice (source + dest) from
`SOURCE_API_TOKEN` / `DEST_API_TOKEN` in a gitignored `.env`, loaded via `tsx --env-file`.
Three sequential phases: **config** (match-or-create tags/lists/products/loss-reasons;
match-by-name only for pipelines/stages/attendants), **leads** (+ notes/attachments),
**businesses** (lead/stage/attendant/status). ID remapping persisted to
`.migration/idmap.json` (resumable checkpoint); `externalId` on businesses stores the
source id. Pure logic (matching, id-map, payload builders) is built test-first with
`node:test`; IO verified via `--dry-run`.

- Spec: `docs/superpowers/specs/2026-05-29-datacrazy-crm-migration-design.md`
- Plan: `docs/superpowers/plans/2026-05-29-datacrazy-crm-migration.md`

### Key API constraints (verified against the OpenAPI spec)
- **Pipelines, stages, attendants are read-only** (GET only) → cannot be created via API;
  must already exist in the destination (matched by name/email).
- **Business value & products have no write path.** `CreateBusinessesDto`/`UpdateBusinessesDto`
  accept only `leadId`, `stageId`, `attendantId`, `externalId`. Migrating monetary value/items
  is deferred to live API exploration (see the `applyBusinessValue` stub).
- `POST /leads` and `POST /tags` return `201` with no documented body → the created id is
  resolved by re-fetching/searching by a known field.
- List responses are `{ count, data: [] }`; paginate via `skip`/`take`.
