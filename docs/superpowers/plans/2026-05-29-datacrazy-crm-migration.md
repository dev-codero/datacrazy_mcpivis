# DataCrazy → DataCrazy Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-time, large-volume migration script that copies config (tags, lists, products, loss reasons), leads (+ notes/attachments) and businesses (lead/stage/attendant/status) from one DataCrazy account to another, remapping all IDs.

**Architecture:** A standalone `tsx` script under `src/migrate/`. It instantiates two `DataCrazyClient`s (source + dest), wrapped with retry/backoff. It runs three sequential phases (config → leads → businesses) and persists an ID map (`.migration/idmap.json`) as a resumable checkpoint. Pure logic (name matching, ID map, payload building) is developed test-first; IO is verified via `--dry-run` against the real accounts.

**Tech Stack:** TypeScript, Node 22, tsx (already in devDeps), `node:test` + `node:assert/strict` for tests (no new deps), existing `DataCrazyClient`.

**Key API facts (from the OpenAPI spec, already verified):**
- List responses are `{ count: number, data: T[] }`. Paginate with `skip`/`take`.
- `POST /businesses` returns the created `BusinessDto` (has `id`).
- `POST /leads` and `POST /tags` return `201` with **no documented body** — must resolve the new id by re-fetching/searching by a known field.
- Pipelines, stages and attendants are **read-only** (GET only) — match by name, never create.
- `CreateBusinessesDto` accepts only `leadId`, `stageId`, `attendantId`, `externalId`. No value/products write path → `applyBusinessValue()` is a stub.
- Create payloads: lead tags/lists are `[{ id }]`; lead attendant is `{ id }`. Business state via `POST /businesses/actions/{move|win|lose|restore}`.

---

### Task 1: Project setup — env, gitignore, npm scripts

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Add scripts to package.json**

In `package.json`, replace the `"scripts"` block with:

```json
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "dev": "tsx src/index.ts",
    "prepare": "npm run build",
    "migrate": "tsx --env-file=.env src/migrate/migrate.ts",
    "test": "node --import tsx --test src/migrate/*.test.ts"
  },
```

- [ ] **Step 2: Ensure `.env` and `.migration/` are gitignored**

Read `.gitignore`. If `.env` is not present, append these lines:

```
.env
.migration/
```

- [ ] **Step 3: Create `.env.example`**

```
# Conta de ORIGEM (de onde os dados saem)
SOURCE_API_TOKEN=
# Conta de DESTINO (para onde os dados vão)
DEST_API_TOKEN=
# Opcionais — default: https://api.datacrazy.io/v1
SOURCE_API_URL=
DEST_API_URL=
```

- [ ] **Step 4: Verify scripts parse**

Run: `npm run migrate -- --help 2>&1 | head -1 || true`
Expected: it fails because `src/migrate/migrate.ts` doesn't exist yet (that's fine at this stage). No JSON parse error from npm.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore .env.example
git commit -m "chore: add migrate/test scripts and env scaffolding"
```

---

### Task 2: Two-account clients

**Files:**
- Create: `src/migrate/clients.ts`

Reuses the existing `DataCrazyClient` (`src/client.ts`) and `Config` (`src/config.ts`). Builds a source client and a dest client from env vars. `safeMode` is irrelevant to the client, set to `false`.

- [ ] **Step 1: Write `src/migrate/clients.ts`**

```typescript
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";

const DEFAULT_URL = "https://api.datacrazy.io/v1";

function buildConfig(token: string | undefined, url: string | undefined, which: string): Config {
  if (!token) {
    throw new Error(`${which} token ausente. Defina-o no .env (veja .env.example).`);
  }
  return { apiToken: token, apiUrl: url || DEFAULT_URL, safeMode: false };
}

export interface MigrationClients {
  source: DataCrazyClient;
  dest: DataCrazyClient;
}

export function buildClients(env: NodeJS.ProcessEnv = process.env): MigrationClients {
  return {
    source: new DataCrazyClient(buildConfig(env.SOURCE_API_TOKEN, env.SOURCE_API_URL, "SOURCE_API_TOKEN")),
    dest: new DataCrazyClient(buildConfig(env.DEST_API_TOKEN, env.DEST_API_URL, "DEST_API_TOKEN")),
  };
}
```

- [ ] **Step 2: Write the failing test `src/migrate/clients.test.ts`**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClients } from "./clients.js";

test("buildClients throws when SOURCE token missing", () => {
  assert.throws(
    () => buildClients({ DEST_API_TOKEN: "x" } as NodeJS.ProcessEnv),
    /SOURCE_API_TOKEN ausente/,
  );
});

test("buildClients builds both clients when tokens present", () => {
  const c = buildClients({ SOURCE_API_TOKEN: "a", DEST_API_TOKEN: "b" } as NodeJS.ProcessEnv);
  assert.ok(c.source);
  assert.ok(c.dest);
});
```

- [ ] **Step 3: Run the test**

Run: `npm test`
Expected: both tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/migrate/clients.ts src/migrate/clients.test.ts
git commit -m "feat(migrate): two-account client builder"
```

---

### Task 3: HTTP retry/backoff wrapper

**Files:**
- Create: `src/migrate/http.ts`
- Test: `src/migrate/http.test.ts`

Wraps any async call, retrying on transient failures (HTTP 429/5xx, surfaced by `DataCrazyClient` as `Error` messages like `DataCrazy API error 503: ...`). Pure timing is injected so tests don't sleep.

- [ ] **Step 1: Write the failing test `src/migrate/http.test.ts`**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { withRetry, isRetryable } from "./http.js";

test("isRetryable true for 429 and 5xx error messages", () => {
  assert.equal(isRetryable(new Error("DataCrazy API error 429: slow down")), true);
  assert.equal(isRetryable(new Error("DataCrazy API error 503: down")), true);
});

test("isRetryable false for 4xx (except 429)", () => {
  assert.equal(isRetryable(new Error("DataCrazy API error 400: bad")), false);
  assert.equal(isRetryable(new Error("DataCrazy API error 404: missing")), false);
});

test("withRetry retries then succeeds", async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error("DataCrazy API error 503: down");
      return "ok";
    },
    { retries: 5, sleep: async () => {} },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("withRetry gives up on non-retryable", async () => {
  let calls = 0;
  await assert.rejects(
    () => withRetry(async () => { calls++; throw new Error("DataCrazy API error 400: bad"); }, { retries: 5, sleep: async () => {} }),
    /400/,
  );
  assert.equal(calls, 1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./http.js`.

- [ ] **Step 3: Write `src/migrate/http.ts`**

```typescript
export function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/API error (\d{3})/);
  if (!m) return false;
  const code = Number(m[1]);
  return code === 429 || (code >= 500 && code <= 599);
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 4;
  const base = opts.baseDelayMs ?? 500;
  const sleep = opts.sleep ?? defaultSleep;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || attempt >= retries) throw err;
      const delay = base * 2 ** attempt;
      await sleep(delay);
      attempt++;
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: all `http` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/migrate/http.ts src/migrate/http.test.ts
git commit -m "feat(migrate): retry/backoff wrapper for transient API errors"
```

---

### Task 4: Name matching utility (pure)

**Files:**
- Create: `src/migrate/match.ts`
- Test: `src/migrate/match.test.ts`

Normalizes names (trim, lowercase, strip accents) and builds a name→id index from a list of `{ id, name }` (or email for attendants). Used by config mapping.

- [ ] **Step 1: Write the failing test `src/migrate/match.test.ts`**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, indexByName, findIdByName } from "./match.js";

test("normalizeName strips accents, case and surrounding space", () => {
  assert.equal(normalizeName("  Configuração  "), "configuracao");
  assert.equal(normalizeName("VENDAS"), "vendas");
});

test("indexByName maps normalized name to id, last wins on dup", () => {
  const idx = indexByName([
    { id: "1", name: "Quente" },
    { id: "2", name: "quente" },
  ]);
  assert.equal(idx.get("quente"), "2");
});

test("findIdByName returns id or undefined", () => {
  const idx = indexByName([{ id: "9", name: "Frio" }]);
  assert.equal(findIdByName(idx, "  frio "), "9");
  assert.equal(findIdByName(idx, "morno"), undefined);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./match.js`.

- [ ] **Step 3: Write `src/migrate/match.ts`**

```typescript
export interface NamedEntity {
  id: string;
  name?: string;
}

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (combining diacriticals)
    .trim()
    .toLowerCase();
}

export function indexByName(entities: NamedEntity[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of entities) {
    if (e.name) map.set(normalizeName(e.name), e.id);
  }
  return map;
}

export function findIdByName(index: Map<string, string>, name: string | undefined): string | undefined {
  if (!name) return undefined;
  return index.get(normalizeName(name));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: all `match` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/migrate/match.ts src/migrate/match.test.ts
git commit -m "feat(migrate): name normalization and matching helpers"
```

---

### Task 5: ID map checkpoint store

**Files:**
- Create: `src/migrate/idmap.ts`
- Test: `src/migrate/idmap.test.ts`

Holds source→dest id mappings per resource kind. Persists to `.migration/idmap.json`. Resumable: loading an existing file returns the saved state; `set` is idempotent.

- [ ] **Step 1: Write the failing test `src/migrate/idmap.test.ts`**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { createIdMap } from "./idmap.js";

test("set/get round-trips per kind", () => {
  const m = createIdMap();
  m.set("tags", "src1", "dst1");
  assert.equal(m.get("tags", "src1"), "dst1");
  assert.equal(m.get("tags", "missing"), undefined);
  assert.equal(m.get("leads", "src1"), undefined);
});

test("has reports membership", () => {
  const m = createIdMap();
  m.set("leads", "L1", "L2");
  assert.equal(m.has("leads", "L1"), true);
  assert.equal(m.has("leads", "L9"), false);
});

test("toJSON / fromJSON round-trip preserves entries", () => {
  const m = createIdMap();
  m.set("businesses", "b1", "b2");
  const json = m.toJSON();
  const restored = createIdMap(JSON.parse(JSON.stringify(json)));
  assert.equal(restored.get("businesses", "b1"), "b2");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./idmap.js`.

- [ ] **Step 3: Write `src/migrate/idmap.ts`**

```typescript
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type IdMapKind =
  | "tags" | "lists" | "products" | "lossReasons"
  | "pipelines" | "stages" | "attendants"
  | "leads" | "businesses";

export type IdMapData = Record<string, Record<string, string>>;

export interface IdMap {
  get(kind: IdMapKind, srcId: string): string | undefined;
  has(kind: IdMapKind, srcId: string): boolean;
  set(kind: IdMapKind, srcId: string, destId: string): void;
  toJSON(): IdMapData;
}

export function createIdMap(initial: IdMapData = {}): IdMap {
  const data: IdMapData = { ...initial };
  return {
    get: (kind, srcId) => data[kind]?.[srcId],
    has: (kind, srcId) => data[kind]?.[srcId] !== undefined,
    set: (kind, srcId, destId) => {
      (data[kind] ??= {})[srcId] = destId;
    },
    toJSON: () => data,
  };
}

const IDMAP_PATH = ".migration/idmap.json";

export async function loadIdMap(path: string = IDMAP_PATH): Promise<IdMap> {
  try {
    const raw = await readFile(path, "utf8");
    return createIdMap(JSON.parse(raw) as IdMapData);
  } catch {
    return createIdMap();
  }
}

export async function saveIdMap(map: IdMap, path: string = IDMAP_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(map.toJSON(), null, 2), "utf8");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: all `idmap` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/migrate/idmap.ts src/migrate/idmap.test.ts
git commit -m "feat(migrate): resumable id-map checkpoint store"
```

---

### Task 6: Pagination + dump

**Files:**
- Create: `src/migrate/dump.ts`
- Test: `src/migrate/dump.test.ts`

`fetchAll` paginates `{ count, data }` responses (also tolerates a bare array or a single object). `dumpSource` writes raw source resources to `.migration/source/*.json` for audit. Only `fetchAll` is unit-tested (pure over an injected fetch page fn).

- [ ] **Step 1: Write the failing test `src/migrate/dump.test.ts`**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchAll, extractList } from "./dump.js";

test("extractList handles {count,data}, bare array, single object", () => {
  assert.deepEqual(extractList({ count: 2, data: [{ id: "a" }, { id: "b" }] }), [{ id: "a" }, { id: "b" }]);
  assert.deepEqual(extractList([{ id: "x" }]), [{ id: "x" }]);
  assert.deepEqual(extractList({ id: "solo" }), [{ id: "solo" }]);
});

test("fetchAll pages until a short page is returned", async () => {
  const pages: Record<number, unknown> = {
    0: { count: 5, data: [{ id: "1" }, { id: "2" }] },
    2: { count: 5, data: [{ id: "3" }, { id: "4" }] },
    4: { count: 5, data: [{ id: "5" }] },
  };
  const all = await fetchAll(async (skip, take) => pages[skip], { take: 2 });
  assert.deepEqual(all.map((r: any) => r.id), ["1", "2", "3", "4", "5"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./dump.js`.

- [ ] **Step 3: Write `src/migrate/dump.ts`**

```typescript
import { mkdir, writeFile } from "node:fs/promises";
import { DataCrazyClient } from "../client.js";
import { withRetry } from "./http.js";

export function extractList(body: unknown): any[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    const data = (body as { data?: unknown }).data;
    if (Array.isArray(data)) return data;
  }
  return body == null ? [] : [body];
}

export interface FetchAllOptions {
  take?: number;
}

export async function fetchAll(
  fetchPage: (skip: number, take: number) => Promise<unknown>,
  opts: FetchAllOptions = {},
): Promise<any[]> {
  const take = opts.take ?? 100;
  const out: any[] = [];
  let skip = 0;
  for (;;) {
    const page = extractList(await fetchPage(skip, take));
    out.push(...page);
    if (page.length < take) break;
    skip += take;
  }
  return out;
}

export async function fetchAllPath(client: DataCrazyClient, path: string, extraParams: Record<string, string | number> = {}): Promise<any[]> {
  return fetchAll((skip, take) => withRetry(() => client.get(path, { skip, take, ...extraParams })), { take: 100 });
}

const SOURCE_DIR = ".migration/source";

export async function dumpJson(name: string, value: unknown, dir: string = SOURCE_DIR): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/${name}.json`, JSON.stringify(value, null, 2), "utf8");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: all `dump` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/migrate/dump.ts src/migrate/dump.test.ts
git commit -m "feat(migrate): pagination, list extraction and source dump"
```

---

### Task 7: Report collector

**Files:**
- Create: `src/migrate/report.ts`
- Test: `src/migrate/report.test.ts`

Accumulates per-kind counts (created/skipped/failed) and free-form warnings (unmatched stages/attendants, businesses pending value). Writes `.migration/report.json` and prints a summary.

- [ ] **Step 1: Write the failing test `src/migrate/report.test.ts`**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { createReport } from "./report.js";

test("counts created/skipped/failed per kind", () => {
  const r = createReport();
  r.created("leads");
  r.created("leads");
  r.skipped("leads");
  r.failed("leads", "L3", "boom");
  const data = r.toJSON();
  assert.deepEqual(data.counts.leads, { created: 2, skipped: 1, failed: 1 });
  assert.equal(data.failures[0].id, "L3");
});

test("warnings are collected", () => {
  const r = createReport();
  r.warn("Atendente 'Ana' não encontrado no destino");
  assert.equal(r.toJSON().warnings.length, 1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./report.js`.

- [ ] **Step 3: Write `src/migrate/report.ts`**

```typescript
import { mkdir, writeFile } from "node:fs/promises";

interface Counts { created: number; skipped: number; failed: number; }
interface Failure { kind: string; id: string; error: string; }

export interface ReportData {
  counts: Record<string, Counts>;
  failures: Failure[];
  warnings: string[];
}

export interface Report {
  created(kind: string): void;
  skipped(kind: string): void;
  failed(kind: string, id: string, error: string): void;
  warn(message: string): void;
  toJSON(): ReportData;
  print(): void;
  save(path?: string): Promise<void>;
}

export function createReport(): Report {
  const counts: Record<string, Counts> = {};
  const failures: Failure[] = [];
  const warnings: string[] = [];
  const bump = (kind: string, field: keyof Counts) => {
    (counts[kind] ??= { created: 0, skipped: 0, failed: 0 })[field]++;
  };
  return {
    created: (k) => bump(k, "created"),
    skipped: (k) => bump(k, "skipped"),
    failed: (k, id, error) => { bump(k, "failed"); failures.push({ kind: k, id, error }); },
    warn: (m) => { warnings.push(m); },
    toJSON: () => ({ counts, failures, warnings }),
    print() {
      console.error("\n===== RELATÓRIO DE MIGRAÇÃO =====");
      for (const [kind, c] of Object.entries(counts)) {
        console.error(`  ${kind}: ${c.created} criados, ${c.skipped} pulados, ${c.failed} falhos`);
      }
      if (warnings.length) {
        console.error("\n  Avisos:");
        for (const w of warnings) console.error(`   - ${w}`);
      }
      if (failures.length) {
        console.error(`\n  ${failures.length} falhas (detalhe em .migration/report.json)`);
      }
    },
    async save(path = ".migration/report.json") {
      await mkdir(".migration", { recursive: true });
      await writeFile(path, JSON.stringify({ counts, failures, warnings }, null, 2), "utf8");
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: all `report` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/migrate/report.ts src/migrate/report.test.ts
git commit -m "feat(migrate): migration report collector"
```

---

### Task 8: Config mapping (match-or-create / match-only)

**Files:**
- Create: `src/migrate/config-map.ts`
- Test: `src/migrate/config-map.test.ts`

Builds the id map for config. Two pure decisions are tested in isolation via `planConfigEntity`: given a source entity, the dest name index, and whether the kind is creatable, decide `reuse` (id) / `create` / `missing`. The IO orchestration (`mapConfig`) uses that decision plus the client.

- [ ] **Step 1: Write the failing test `src/migrate/config-map.test.ts`**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { planConfigEntity } from "./config-map.js";
import { indexByName } from "./match.js";

test("reuse when name exists in dest", () => {
  const idx = indexByName([{ id: "d1", name: "Quente" }]);
  assert.deepEqual(planConfigEntity({ id: "s1", name: "quente" }, idx, true), { action: "reuse", destId: "d1" });
});

test("create when missing and kind is creatable", () => {
  const idx = indexByName([]);
  assert.deepEqual(planConfigEntity({ id: "s1", name: "Nova" }, idx, true), { action: "create" });
});

test("missing when not in dest and kind is read-only", () => {
  const idx = indexByName([]);
  assert.deepEqual(planConfigEntity({ id: "s1", name: "Pipe X" }, idx, false), { action: "missing" });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./config-map.js`.

- [ ] **Step 3: Write `src/migrate/config-map.ts`**

```typescript
import { DataCrazyClient } from "../client.js";
import { withRetry } from "./http.js";
import { fetchAllPath, dumpJson } from "./dump.js";
import { indexByName, findIdByName, NamedEntity } from "./match.js";
import { IdMap, IdMapKind } from "./idmap.js";
import { Report } from "./report.js";

export type ConfigPlan =
  | { action: "reuse"; destId: string }
  | { action: "create" }
  | { action: "missing" };

export function planConfigEntity(src: NamedEntity, destIndex: Map<string, string>, creatable: boolean): ConfigPlan {
  const destId = findIdByName(destIndex, src.name);
  if (destId) return { action: "reuse", destId };
  return creatable ? { action: "create" } : { action: "missing" };
}

interface CreatableSpec {
  kind: IdMapKind;
  listPath: string;
  createPath: string;
  buildBody: (src: any) => unknown;
  resolveCreatedId: (created: unknown, src: any, destList: any[]) => string | undefined;
}

// Tags/Lists/Products/LossReasons. POST may return 201 with no body, so we
// re-fetch the dest list and resolve the new id by name (id_sku for products).
const CREATABLE: CreatableSpec[] = [
  {
    kind: "tags", listPath: "/api/v1/tags", createPath: "/api/v1/tags",
    buildBody: (s) => ({ name: s.name, color: s.color, description: s.description }),
    resolveCreatedId: (_c, s, list) => findIdByName(indexByName(list), s.name),
  },
  {
    kind: "lists", listPath: "/api/v1/lists", createPath: "/api/v1/lists",
    buildBody: (s) => ({ name: s.name, description: s.description }),
    resolveCreatedId: (_c, s, list) => findIdByName(indexByName(list), s.name),
  },
  {
    kind: "products", listPath: "/api/v1/products", createPath: "/api/v1/products",
    buildBody: (s) => ({ name: s.name, price: s.price, id_sku: s.id_sku }),
    resolveCreatedId: (_c, s, list) => findIdByName(indexByName(list), s.name),
  },
  {
    kind: "lossReasons", listPath: "/api/v1/business-loss-reasons", createPath: "/api/v1/business-loss-reasons",
    buildBody: (s) => ({ name: s.name, requiredJustification: !!s.requiredJustification }),
    resolveCreatedId: (_c, s, list) => findIdByName(indexByName(list), s.name),
  },
];

async function mapCreatable(spec: CreatableSpec, source: DataCrazyClient, dest: DataCrazyClient, map: IdMap, report: Report, dryRun: boolean) {
  const srcList = await fetchAllPath(source, spec.listPath);
  await dumpJson(spec.kind, srcList);
  let destList = await fetchAllPath(dest, spec.listPath);
  let destIndex = indexByName(destList);

  for (const src of srcList) {
    if (map.has(spec.kind, src.id)) { report.skipped(spec.kind); continue; }
    const plan = planConfigEntity(src, destIndex, true);
    try {
      if (plan.action === "reuse") {
        map.set(spec.kind, src.id, plan.destId);
        report.skipped(spec.kind);
        continue;
      }
      if (dryRun) { report.warn(`[dry-run] criaria ${spec.kind}: ${src.name}`); continue; }
      const created = await withRetry(() => dest.post(spec.createPath, spec.buildBody(src)));
      destList = await fetchAllPath(dest, spec.listPath);
      destIndex = indexByName(destList);
      const newId = spec.resolveCreatedId(created, src, destList);
      if (!newId) { report.failed(spec.kind, src.id, "id do criado não resolvido"); continue; }
      map.set(spec.kind, src.id, newId);
      report.created(spec.kind);
    } catch (err) {
      report.failed(spec.kind, src.id, err instanceof Error ? err.message : String(err));
    }
  }
}

// Pipelines/stages/attendants are read-only — match only.
async function mapReadOnly(source: DataCrazyClient, dest: DataCrazyClient, map: IdMap, report: Report) {
  // Pipelines + stages
  const srcPipelines = await fetchAllPath(source, "/api/v1/pipelines");
  const destPipelines = await fetchAllPath(dest, "/api/v1/pipelines");
  await dumpJson("pipelines", srcPipelines);
  const destPipeIndex = indexByName(destPipelines);

  for (const sp of srcPipelines) {
    const destPipeId = findIdByName(destPipeIndex, sp.name);
    if (!destPipeId) { report.warn(`Pipeline '${sp.name}' não existe no destino (crie na UI)`); continue; }
    map.set("pipelines", sp.id, destPipeId);
    const srcStages = await fetchAllPath(source, `/api/v1/pipelines/${sp.id}/stages`);
    const destStages = await fetchAllPath(dest, `/api/v1/pipelines/${destPipeId}/stages`);
    const destStageIndex = indexByName(destStages);
    for (const ss of srcStages) {
      const destStageId = findIdByName(destStageIndex, ss.name);
      if (!destStageId) { report.warn(`Estágio '${ss.name}' (pipeline '${sp.name}') não existe no destino`); continue; }
      map.set("stages", ss.id, destStageId);
    }
  }

  // Attendants — match by name, fall back to email
  const srcAtt = await fetchAllPath(source, "/api/v1/attendants/crm");
  const destAtt = await fetchAllPath(dest, "/api/v1/attendants/crm");
  await dumpJson("attendants", srcAtt);
  const byName = indexByName(destAtt);
  const byEmail = new Map<string, string>(destAtt.filter((a: any) => a.email).map((a: any) => [String(a.email).toLowerCase(), a.id]));
  for (const sa of srcAtt) {
    const destId = findIdByName(byName, sa.name) ?? (sa.email ? byEmail.get(String(sa.email).toLowerCase()) : undefined);
    if (!destId) { report.warn(`Atendente '${sa.name}' não encontrado no destino (vínculo será descartado)`); continue; }
    map.set("attendants", sa.id, destId);
  }
}

export async function mapConfig(source: DataCrazyClient, dest: DataCrazyClient, map: IdMap, report: Report, dryRun: boolean) {
  for (const spec of CREATABLE) {
    await mapCreatable(spec, source, dest, map, report, dryRun);
  }
  await mapReadOnly(source, dest, map, report);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: all `config-map` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/migrate/config-map.ts src/migrate/config-map.test.ts
git commit -m "feat(migrate): config mapping (match-or-create + read-only matching)"
```

---

### Task 9: Leads migration

**Files:**
- Create: `src/migrate/leads.ts`
- Test: `src/migrate/leads.test.ts`

`buildLeadBody` (pure) remaps tags/lists/attendant via the id map and copies scalar fields. `migrateLeads` paginates source leads, creates each in dest, resolves the new id (from the create response if present, else by `search`), records the mapping, then migrates notes + attachments.

- [ ] **Step 1: Write the failing test `src/migrate/leads.test.ts`**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLeadBody } from "./leads.js";
import { createIdMap } from "./idmap.js";

test("buildLeadBody copies scalars and remaps tags/lists/attendant", () => {
  const map = createIdMap();
  map.set("tags", "t-src", "t-dst");
  map.set("lists", "l-src", "l-dst");
  map.set("attendants", "a-src", "a-dst");
  const src = {
    id: "lead1", name: "Maria", phone: "5199", email: "m@x.com", company: "ACME",
    taxId: "123", source: "site", site: "x.com", instagram: "@m", birthDate: "1990-01-01",
    tags: [{ id: "t-src" }], lists: [{ id: "l-src" }], attendant: { id: "a-src" },
  };
  const body = buildLeadBody(src, map);
  assert.equal(body.name, "Maria");
  assert.equal(body.taxId, "123");
  assert.equal(body.birthDate, "1990-01-01");
  assert.deepEqual(body.tags, [{ id: "t-dst" }]);
  assert.deepEqual(body.lists, [{ id: "l-dst" }]);
  assert.deepEqual(body.attendant, { id: "a-dst" });
});

test("buildLeadBody drops unmapped attendant and tags", () => {
  const map = createIdMap();
  const body = buildLeadBody({ id: "x", name: "Zé", attendant: { id: "ghost" }, tags: [{ id: "nope" }] }, map);
  assert.equal(body.attendant, undefined);
  assert.deepEqual(body.tags, []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./leads.js`.

- [ ] **Step 3: Write `src/migrate/leads.ts`**

```typescript
import { DataCrazyClient } from "../client.js";
import { withRetry } from "./http.js";
import { fetchAllPath, extractList, dumpJson } from "./dump.js";
import { IdMap } from "./idmap.js";
import { Report } from "./report.js";

function remapIdArray(arr: any[] | undefined, map: IdMap, kind: "tags" | "lists"): { id: string }[] {
  if (!Array.isArray(arr)) return [];
  const out: { id: string }[] = [];
  for (const item of arr) {
    const srcId = typeof item === "string" ? item : item?.id;
    const destId = srcId ? map.get(kind, srcId) : undefined;
    if (destId) out.push({ id: destId });
  }
  return out;
}

export function buildLeadBody(src: any, map: IdMap): Record<string, any> {
  const body: Record<string, any> = {};
  for (const f of ["name", "phone", "email", "company", "taxId", "source", "site", "instagram", "image", "birthDate"]) {
    if (src[f] != null) body[f] = src[f];
  }
  body.tags = remapIdArray(src.tags, map, "tags");
  body.lists = remapIdArray(src.lists, map, "lists");
  const attSrc = src.attendant?.id;
  const attDest = attSrc ? map.get("attendants", attSrc) : undefined;
  if (attDest) body.attendant = { id: attDest };
  return body;
}

async function resolveCreatedLeadId(created: unknown, src: any, dest: DataCrazyClient): Promise<string | undefined> {
  const fromBody = (created as any)?.id ?? (created as any)?.data?.id;
  if (fromBody) return fromBody;
  // Fallback: search by the most unique field available.
  const term = src.email || src.phone || src.taxId || src.name;
  if (!term) return undefined;
  const found = extractList(await withRetry(() => dest.get("/api/v1/leads", { search: term, take: 5 })));
  const match = found.find((l: any) =>
    (src.email && l.email === src.email) ||
    (src.phone && l.phone === src.phone) ||
    (src.taxId && l.taxId === src.taxId) ||
    (src.name && l.name === src.name),
  );
  return match?.id;
}

async function migrateNotes(srcLeadId: string, destLeadId: string, source: DataCrazyClient, dest: DataCrazyClient, report: Report, dryRun: boolean) {
  const notes = await fetchAllPath(source, `/api/v1/leads/${srcLeadId}/notes`);
  for (const n of notes) {
    if (dryRun) { report.warn(`[dry-run] criaria nota no lead ${destLeadId}`); continue; }
    try {
      await withRetry(() => dest.post(`/api/v1/leads/${destLeadId}/notes`, { note: n.note ?? n.text ?? "" }));
      report.created("notes");
    } catch (err) {
      report.failed("notes", srcLeadId, err instanceof Error ? err.message : String(err));
    }
  }
}

async function migrateAttachments(srcLeadId: string, destLeadId: string, source: DataCrazyClient, dest: DataCrazyClient, report: Report, dryRun: boolean) {
  const atts = await fetchAllPath(source, `/api/v1/leads/${srcLeadId}/attachments`);
  for (const a of atts) {
    if (dryRun) { report.warn(`[dry-run] criaria anexo no lead ${destLeadId}`); continue; }
    try {
      await withRetry(() => dest.post(`/api/v1/leads/${destLeadId}/attachments`, {
        attachmentUrl: a.attachmentUrl ?? a.url,
        fileName: a.fileName,
        fileSize: a.fileSize,
        description: a.description,
      }));
      report.created("attachments");
    } catch (err) {
      report.failed("attachments", srcLeadId, err instanceof Error ? err.message : String(err));
    }
  }
}

export interface MigrateLeadsOptions { dryRun: boolean; dedupeLeads: boolean; }

export async function migrateLeads(source: DataCrazyClient, dest: DataCrazyClient, map: IdMap, report: Report, opts: MigrateLeadsOptions) {
  const leads = await fetchAllPath(source, "/api/v1/leads", { "complete[additionalFields]": "true" } as any);
  await dumpJson("leads", leads);

  for (const src of leads) {
    if (map.has("leads", src.id)) { report.skipped("leads"); continue; }
    try {
      if (opts.dedupeLeads && (src.email || src.phone)) {
        const term = src.email || src.phone;
        const found = extractList(await withRetry(() => dest.get("/api/v1/leads", { search: term, take: 5 })));
        const dup = found.find((l: any) => (src.email && l.email === src.email) || (src.phone && l.phone === src.phone));
        if (dup) { map.set("leads", src.id, dup.id); report.skipped("leads"); continue; }
      }
      if (opts.dryRun) { report.warn(`[dry-run] criaria lead: ${src.name ?? src.id}`); continue; }
      const created = await withRetry(() => dest.post("/api/v1/leads", buildLeadBody(src, map)));
      const newId = await resolveCreatedLeadId(created, src, dest);
      if (!newId) { report.failed("leads", src.id, "id do lead criado não resolvido"); continue; }
      map.set("leads", src.id, newId);
      report.created("leads");
      await migrateNotes(src.id, newId, source, dest, report, opts.dryRun);
      await migrateAttachments(src.id, newId, source, dest, report, opts.dryRun);
    } catch (err) {
      report.failed("leads", src.id, err instanceof Error ? err.message : String(err));
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: all `leads` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/migrate/leads.ts src/migrate/leads.test.ts
git commit -m "feat(migrate): leads migration with notes and attachments"
```

---

### Task 10: Businesses migration

**Files:**
- Create: `src/migrate/businesses.ts`
- Test: `src/migrate/businesses.test.ts`

`buildBusinessBody` (pure) remaps `leadId`/`stageId`/`attendantId` and sets `externalId` = source business id. `planBusinessState` (pure) decides which action (`win`/`lose`/none) follows creation, from the source `status`. `migrateBusinesses` orchestrates create → state, skips businesses whose stage didn't map, and calls the `applyBusinessValue` stub.

- [ ] **Step 1: Write the failing test `src/migrate/businesses.test.ts`**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBusinessBody, planBusinessState } from "./businesses.js";
import { createIdMap } from "./idmap.js";

test("buildBusinessBody remaps ids and sets externalId to source id", () => {
  const map = createIdMap();
  map.set("leads", "lead-src", "lead-dst");
  map.set("stages", "stage-src", "stage-dst");
  map.set("attendants", "att-src", "att-dst");
  const body = buildBusinessBody({ id: "biz1", leadId: "lead-src", stageId: "stage-src", attendantId: "att-src" }, map);
  assert.deepEqual(body, { leadId: "lead-dst", stageId: "stage-dst", attendantId: "att-dst", externalId: "biz1" });
});

test("buildBusinessBody returns null when lead or stage unmapped", () => {
  const map = createIdMap();
  map.set("leads", "lead-src", "lead-dst");
  assert.equal(buildBusinessBody({ id: "b", leadId: "lead-src", stageId: "ghost" }, map), null);
});

test("planBusinessState maps status to action", () => {
  const map = createIdMap();
  map.set("lossReasons", "lr-src", "lr-dst");
  assert.deepEqual(planBusinessState({ status: "won" }, map), { action: "win" });
  assert.deepEqual(planBusinessState({ status: "in_process" }, map), { action: "none" });
  assert.deepEqual(
    planBusinessState({ status: "lost", lossReasonId: "lr-src", justification: "caro" }, map),
    { action: "lose", lossReasonId: "lr-dst", justification: "caro" },
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./businesses.js`.

- [ ] **Step 3: Write `src/migrate/businesses.ts`**

```typescript
import { DataCrazyClient } from "../client.js";
import { withRetry } from "./http.js";
import { fetchAllPath, dumpJson } from "./dump.js";
import { IdMap } from "./idmap.js";
import { Report } from "./report.js";

export interface BusinessBody { leadId: string; stageId: string; attendantId?: string; externalId: string; }

export function buildBusinessBody(src: any, map: IdMap): BusinessBody | null {
  const leadId = map.get("leads", src.leadId);
  const stageId = map.get("stages", src.stageId);
  if (!leadId || !stageId) return null;
  const body: BusinessBody = { leadId, stageId, externalId: String(src.id) };
  const att = src.attendantId ? map.get("attendants", src.attendantId) : undefined;
  if (att) body.attendantId = att;
  return body;
}

export type BusinessStatePlan =
  | { action: "none" }
  | { action: "win" }
  | { action: "lose"; lossReasonId?: string; justification?: string };

export function planBusinessState(src: any, map: IdMap): BusinessStatePlan {
  if (src.status === "won") return { action: "win" };
  if (src.status === "lost") {
    return {
      action: "lose",
      lossReasonId: src.lossReasonId ? map.get("lossReasons", src.lossReasonId) : undefined,
      justification: src.justification,
    };
  }
  return { action: "none" };
}

// Stub: filled in after live API exploration once value/products write path is enabled.
export async function applyBusinessValue(_destBusinessId: string, _src: any, _dest: DataCrazyClient, report: Report): Promise<void> {
  if (_src.total != null && _src.total !== 0) {
    report.warn(`Negócio ${_src.id}: valor ${_src.total} não migrado (sem endpoint de escrita — pendente)`);
  }
}

export interface MigrateBusinessesOptions { dryRun: boolean; }

export async function migrateBusinesses(source: DataCrazyClient, dest: DataCrazyClient, map: IdMap, report: Report, opts: MigrateBusinessesOptions) {
  const businesses = await fetchAllPath(source, "/api/v1/businesses");
  await dumpJson("businesses", businesses);

  for (const src of businesses) {
    if (map.has("businesses", src.id)) { report.skipped("businesses"); continue; }
    const body = buildBusinessBody(src, map);
    if (!body) {
      report.failed("businesses", src.id, "lead ou estágio não mapeado");
      report.warn(`Negócio ${src.id} pulado: estágio '${src.stageId}' ou lead '${src.leadId}' sem mapeamento`);
      continue;
    }
    if (opts.dryRun) { report.warn(`[dry-run] criaria negócio (lead ${body.leadId}, stage ${body.stageId})`); continue; }
    try {
      const created: any = await withRetry(() => dest.post("/api/v1/businesses", body));
      const newId = created?.id ?? created?.data?.id;
      if (!newId) { report.failed("businesses", src.id, "id do negócio criado não resolvido"); continue; }
      map.set("businesses", src.id, newId);
      report.created("businesses");

      const state = planBusinessState(src, map);
      if (state.action === "win") {
        await withRetry(() => dest.post("/api/v1/businesses/actions/win", { ids: [newId] }));
      } else if (state.action === "lose") {
        const loseBody: Record<string, unknown> = { ids: [newId] };
        if (state.lossReasonId) loseBody.lossReasonId = state.lossReasonId;
        if (state.justification) loseBody.justification = state.justification;
        await withRetry(() => dest.post("/api/v1/businesses/actions/lose", loseBody));
      }
      await applyBusinessValue(newId, src, dest, report);
    } catch (err) {
      report.failed("businesses", src.id, err instanceof Error ? err.message : String(err));
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: all `businesses` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/migrate/businesses.ts src/migrate/businesses.test.ts
git commit -m "feat(migrate): businesses migration with state + value stub"
```

---

### Task 11: Orchestrator + CLI

**Files:**
- Create: `src/migrate/migrate.ts`
- Test: `src/migrate/migrate.test.ts`

`parseArgs` (pure) reads `--dry-run`, `--dedupe-leads`, `--only=<phase>`. `main` wires clients, loads the id map, runs the requested phases, saves the map after each phase, then prints + saves the report.

- [ ] **Step 1: Write the failing test `src/migrate/migrate.test.ts`**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "./migrate.js";

test("parseArgs defaults: all phases, no dry-run, no dedupe", () => {
  const a = parseArgs([]);
  assert.deepEqual(a, { dryRun: false, dedupeLeads: false, phases: ["config", "leads", "businesses"] });
});

test("parseArgs reads flags", () => {
  const a = parseArgs(["--dry-run", "--dedupe-leads", "--only=leads"]);
  assert.equal(a.dryRun, true);
  assert.equal(a.dedupeLeads, true);
  assert.deepEqual(a.phases, ["leads"]);
});

test("parseArgs throws on invalid --only", () => {
  assert.throws(() => parseArgs(["--only=bogus"]), /only inválido/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./migrate.js`.

- [ ] **Step 3: Write `src/migrate/migrate.ts`**

```typescript
import { buildClients } from "./clients.js";
import { loadIdMap, saveIdMap } from "./idmap.js";
import { createReport } from "./report.js";
import { mapConfig } from "./config-map.js";
import { migrateLeads } from "./leads.js";
import { migrateBusinesses } from "./businesses.js";

const ALL_PHASES = ["config", "leads", "businesses"] as const;
type Phase = (typeof ALL_PHASES)[number];

export interface Args { dryRun: boolean; dedupeLeads: boolean; phases: Phase[]; }

export function parseArgs(argv: string[]): Args {
  const dryRun = argv.includes("--dry-run");
  const dedupeLeads = argv.includes("--dedupe-leads");
  const onlyArg = argv.find((a) => a.startsWith("--only="));
  let phases: Phase[] = [...ALL_PHASES];
  if (onlyArg) {
    const value = onlyArg.split("=")[1] as Phase;
    if (!ALL_PHASES.includes(value)) throw new Error(`--only inválido: ${value} (use config|leads|businesses)`);
    phases = [value];
  }
  return { dryRun, dedupeLeads, phases };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { source, dest } = buildClients();
  const map = await loadIdMap();
  const report = createReport();

  console.error(`Migração iniciada — fases: ${args.phases.join(", ")}${args.dryRun ? " (DRY-RUN)" : ""}`);

  if (args.phases.includes("config")) {
    console.error("Fase 1: config");
    await mapConfig(source, dest, map, report, args.dryRun);
    await saveIdMap(map);
  }
  if (args.phases.includes("leads")) {
    console.error("Fase 2: leads");
    await migrateLeads(source, dest, map, report, { dryRun: args.dryRun, dedupeLeads: args.dedupeLeads });
    await saveIdMap(map);
  }
  if (args.phases.includes("businesses")) {
    console.error("Fase 3: negócios");
    await migrateBusinesses(source, dest, map, report, { dryRun: args.dryRun });
    await saveIdMap(map);
  }

  report.print();
  await report.save();
}

// Run only when executed directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  main().catch((err) => {
    console.error("Migração falhou:", err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: all `migrate` tests PASS (and `main` does not run during tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests across all modules PASS.

- [ ] **Step 6: Commit**

```bash
git add src/migrate/migrate.ts src/migrate/migrate.test.ts
git commit -m "feat(migrate): orchestrator and CLI argument parsing"
```

---

### Task 12: Docs + dry-run verification

**Files:**
- Create: `src/migrate/README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write `src/migrate/README.md`**

````markdown
# Migração DataCrazy → DataCrazy

Script único para copiar config + leads + negócios de uma conta para outra.

## Setup
1. Copie `.env.example` para `.env` e preencha `SOURCE_API_TOKEN` e `DEST_API_TOKEN`.
2. Garanta que o destino já tem as **pipelines e estágios** com os mesmos nomes da origem
   (a API não permite criá-los). Atendentes também são casados por nome/email.

## Uso
```bash
npm run migrate -- --dry-run            # simula, não grava leads/negócios
npm run migrate                         # executa todas as fases
npm run migrate -- --only=config        # só config
npm run migrate -- --only=leads --dedupe-leads
npm run migrate -- --only=businesses
```

## Saídas
- `.migration/source/*.json` — dump bruto da origem (auditoria)
- `.migration/idmap.json` — checkpoint id_origem→id_destino (permite retomar)
- `.migration/report.json` — relatório (criados/pulados/falhos + avisos)

## Limitações conhecidas
- **Valor e itens de negócio não são migrados** (a API não expõe escrita). Ver o stub
  `applyBusinessValue` em `businesses.ts` — a ser preenchido após exploração ao vivo.
- Pipelines/estágios/atendentes ausentes no destino são reportados como pendência.
````

- [ ] **Step 2: Add a Migration section to CLAUDE.md**

Append to `CLAUDE.md`:

```markdown

## Migration (src/migrate/)
One-time DataCrazy→DataCrazy migration script (`npm run migrate`). Reuses `DataCrazyClient`
with two accounts (`SOURCE_API_TOKEN`/`DEST_API_TOKEN` in `.env`). Three phases: config
(match-or-create tags/lists/products/loss-reasons, match-only pipelines/stages/attendants),
leads (+notes/attachments), businesses (lead/stage/attendant/status). ID remapping via
`.migration/idmap.json` checkpoint. Business value/products NOT migrated (no API write path)
— see `applyBusinessValue` stub. See `src/migrate/README.md`.
```

- [ ] **Step 3: Run the dry-run against the real accounts**

Prerequisite: `.env` filled with valid tokens.
Run: `npm run migrate -- --dry-run --only=config`
Expected: console shows "Fase 1: config" and a report with reuse/`[dry-run] criaria ...`
lines and any unmatched pipeline/attendant warnings. No errors thrown. Inspect
`.migration/source/*.json` to confirm the source dump looks right.

> If `POST /leads` or `POST /tags` turn out to return the created object with an `id`,
> the search fallback in `resolveCreatedLeadId` / `resolveCreatedId` simply won't be hit —
> no change needed. If they return something unexpected, adjust those resolvers.

- [ ] **Step 4: Commit**

```bash
git add src/migrate/README.md CLAUDE.md
git commit -m "docs(migrate): usage README and CLAUDE.md migration section"
```

---

## Notes for the implementer

- **Run order matters:** config → leads → businesses. Businesses depend on lead + stage
  mappings; leads depend on tag/list/attendant mappings.
- **Resumability:** the id map is saved after each phase and consulted via `map.has(...)`
  before creating anything, so re-running skips already-migrated records.
- **The value/products gap is intentional** and isolated in `applyBusinessValue`. When the
  user enables the feature, explore the live API and implement only that function.
- **First real run:** always `--dry-run` first, review `.migration/report.json`, fix any
  unmatched pipelines/stages/attendants in the dest UI, then run for real.
