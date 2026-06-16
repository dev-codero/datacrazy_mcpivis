// scripts/probe-api.ts
// Probe the real DataCrazy API shape to confirm the join business + lead + additionalFields.
//
// Usage:  npx tsx scripts/probe-api.ts

import { loadConfig } from "../src/config.js";
import { DataCrazyClient } from "../src/client.js";

const cfg = loadConfig();
// OpenAPI servers: https://api.g1.datacrazy.io (sem /v1) + paths /api/v1/...
const baseUrl = cfg.apiUrl.replace(/\/v1\/?$/, "");
const client = new DataCrazyClient({ ...cfg, apiUrl: baseUrl });
console.log("Using baseUrl:", baseUrl);

function show(title: string, data: unknown) {
  console.log("\n========== " + title + " ==========");
  console.log(JSON.stringify(data, null, 2).slice(0, 4000));
  if (JSON.stringify(data).length > 4000) console.log("... [truncated]");
}

async function main() {
  // 1) Listar 1 business
  const list = await client.get<{ count: number; data: Array<{ id: string; leadId: string; name?: string }> }>(
    "/api/v1/businesses",
    { take: 1 },
  );
  show("GET /businesses (take=1)", list);

  const business = list.data?.[0];
  if (!business) {
    console.log("Nenhum business encontrado. Aborta probe.");
    return;
  }

  // 2) Buscar o business por ID
  const detail = await client.get(`/api/v1/businesses/${business.id}`);
  show("GET /businesses/{id}", detail);

  // 3) Buscar o lead pelo leadId do business
  const lead = await client.get(`/api/v1/leads/${business.leadId}`);
  show("GET /leads/{leadId}", lead);

  // 4) Tentar com complete[additionalFields]=true (variação documentada)
  try {
    const leadWith = await client.get("/api/v1/leads/" + business.leadId, {
      "complete[additionalFields]": true,
    } as Record<string, string | number | boolean | undefined>);
    show("GET /leads/{id}?complete[additionalFields]=true", leadWith);
  } catch (e) {
    console.log("\n[skip] complete[additionalFields] não aceito:", (e as Error).message);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
