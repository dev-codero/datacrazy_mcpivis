# MCP DataCrazy CRM — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an MCP server exposing all 63 DataCrazy CRM API endpoints as individual tools with configurable safe mode.

**Architecture:** TypeScript MCP server using stdio transport. HTTP client wraps fetch with auth. Each resource module registers its tools. Safe mode gates destructive operations behind confirmation.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, tsup, zod

---

### Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

**Step 1: Create package.json**

```json
{
  "name": "mcp-datacrazy",
  "version": "1.0.0",
  "description": "MCP server for DataCrazy CRM - gives AI full access to CRM operations",
  "main": "dist/index.js",
  "bin": {
    "mcp-datacrazy": "dist/index.js"
  },
  "type": "module",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "dev": "tsx src/index.ts",
    "prepare": "npm run build"
  },
  "keywords": ["mcp", "datacrazy", "crm"],
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "@types/node": "^22.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"]
}
```

**Step 3: Install dependencies**

Run: `npm install`

---

### Task 2: Core — Config

**Files:**
- Create: `src/config.ts`

Config reads env vars and validates them.

```typescript
export interface Config {
  apiToken: string;
  apiUrl: string;
  safeMode: boolean;
}

export function loadConfig(): Config {
  const apiToken = process.env.DATACRAZY_API_TOKEN;
  if (!apiToken) {
    throw new Error("DATACRAZY_API_TOKEN is required");
  }
  return {
    apiToken,
    apiUrl: process.env.DATACRAZY_API_URL || "https://api.datacrazy.io/v1",
    safeMode: process.env.SAFE_MODE !== "false",
  };
}
```

---

### Task 3: Core — HTTP Client

**Files:**
- Create: `src/client.ts`

Wraps fetch with auth header, error handling, pagination params.

```typescript
import { Config } from "./config.js";

export class DataCrazyClient {
  constructor(private config: Config) {}

  private get headers() {
    return {
      "access-token": this.config.apiToken,
      "Content-Type": "application/json",
    };
  }

  async get(path: string, params?: Record<string, string | number | boolean | undefined>) {
    const url = new URL(`${this.config.apiUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    const res = await fetch(url.toString(), { headers: this.headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API error ${res.status}: ${body}`);
    }
    return res.json();
  }

  async post(path: string, body?: unknown) {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: "POST",
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async put(path: string, body: unknown) {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async patch(path: string, body: unknown) {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async delete(path: string) {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: "DELETE",
      headers: this.headers,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json();
  }
}
```

---

### Task 4: Core — Safe Mode

**Files:**
- Create: `src/safe-mode.ts`

```typescript
import { Config } from "./config.js";

export function requireConfirmation(
  config: Config,
  confirm: boolean | undefined,
  action: string
): { blocked: true; message: string } | { blocked: false } {
  if (!config.safeMode || confirm) {
    return { blocked: false };
  }
  return {
    blocked: true,
    message: `SAFE_MODE ativado. Para executar "${action}", passe confirm: true. Esta acao nao pode ser desfeita.`,
  };
}
```

---

### Task 5: Core — Index / Entry Point

**Files:**
- Create: `src/index.ts`

Entry point that creates MCP server, registers all tools, starts stdio transport.

---

### Task 6: Tools — Leads (5 tools)

**Files:** Create `src/tools/leads.ts`

Endpoints:
- GET /api/v1/leads — list_leads (skip, take, search, filter params)
- POST /api/v1/leads — create_lead (CreateUpdateLeadDto)
- GET /api/v1/leads/{id} — get_lead
- PATCH /api/v1/leads/{id} — update_lead (CreateUpdateLeadDto)
- DELETE /api/v1/leads/{id} — delete_lead (safe mode)

---

### Task 7: Tools — Lead Sub-resources (10 tools)

**Files:**
- Create: `src/tools/lead-attachments.ts` (3 tools)
- Create: `src/tools/lead-notes.ts` (4 tools)
- Create: `src/tools/lead-history.ts` (1 tool)
- Create: `src/tools/lead-activities.ts` (1 tool)
- Create: `src/tools/lead-businesses.ts` (1 tool)

---

### Task 8: Tools — Businesses + Actions (9 tools)

**Files:**
- Create: `src/tools/businesses.ts` (5 CRUD tools)
- Create: `src/tools/business-actions.ts` (4 action tools: win, lose, move, restore)

---

### Task 9: Tools — Activities (5 tools)

**Files:** Create `src/tools/activities.ts`

---

### Task 10: Tools — Conversations (4 tools)

**Files:** Create `src/tools/conversations.ts`

---

### Task 11: Tools — Simple CRUD modules (20 tools)

**Files:**
- Create: `src/tools/tags.ts` (5 tools)
- Create: `src/tools/lists.ts` (5 tools)
- Create: `src/tools/products.ts` (5 tools)
- Create: `src/tools/loss-reasons.ts` (5 tools)

---

### Task 12: Tools — Read-only modules (6 tools)

**Files:**
- Create: `src/tools/pipelines.ts` (3 tools)
- Create: `src/tools/attendants.ts` (4 tools)
- Create: `src/tools/instances.ts` (2 tools)

---

### Task 13: Index — Wire all tools

**Files:** Modify `src/index.ts` to import and register all tool modules.

---

### Task 14: Build & Test

Run: `npm run build`
Verify: binary runs with `node dist/index.js`

---
