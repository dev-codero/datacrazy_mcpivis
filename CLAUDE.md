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
