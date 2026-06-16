// scripts/debug-payload.ts
// Para UM negocio ja enviado, mostra a URL completa que foi pro n8n (com todos os params).

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";
import { readFileSync } from "node:fs";

const cfg = loadConfig();
const mcp = new McpClient(cfg);
const state = JSON.parse(readFileSync(".sync-state.json", "utf-8")) as Record<string, unknown>;

// Pega o ultimo enviado que tinha gclid
const targetId = "03a09ab9-42c1-4520-b040-8191bb35a302"; // mercado super pratico, tinha gclid=adwdadwdadwdad
const meta = state[targetId] as { planilha: string; etapa: string; sentAt: string };
const stageId = meta.etapa === "Orcamento Enviado"
  ? "cfc192bd-9a14-4a68-8d07-d74a83f7199f"
  : "33b14c90-4d8a-45c8-b98a-12770ead38b6";
const r = (await mcp.callTool("business_list_by_stage", { stageId, take: 300 })) as { data?: Array<Record<string, unknown>> };
const b = r.data?.find((x) => String(x.id) === targetId);
if (!b) { console.log("nao achei"); process.exit(1); }

const lead = (await mcp.callTool("lead_get", { id: b.leadId as string })) as Record<string, unknown>;
const af = (lead.additionalFields as Array<{ additionalField?: { name?: string }; value?: unknown }>) ?? [];

function pickPhone(lead: Record<string, unknown>): string | undefined {
  return (lead.rawPhone as string) || (lead.phone as string);
}
function pickGclid(lead: Record<string, unknown>): string | undefined {
  const lc = ["gclid", "wbraid", "gbraid", "pageid"];
  for (const f of af) {
    if (lc.includes((f.additionalField?.name ?? "").toLowerCase())) {
      const v = f.value;
      if (v !== null && v !== undefined && v !== "") return String(v);
    }
  }
  return undefined;
}

const payload = {
  etapa: meta.etapa,
  telefone: pickPhone(lead),
  email: (lead.email as string) || undefined,
  gclid: pickGclid(lead),
  valor: b.total as number | undefined,
};

console.log("=== PAYLOAD QUE FOI ENVIADO ===");
console.log(JSON.stringify(payload, null, 2));

const u = new URL(cfg.n8nWebhookUrl);
for (const [k, v] of Object.entries(payload)) {
  if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
}
console.log("\n=== URL COMPLETA DO POST ===");
console.log(u.toString());

console.log("\n=== TODOS OS ADDITIONAL FIELDS DO LEAD ===");
for (const f of af) {
  console.log(`  ${f.additionalField?.name} = ${f.value}`);
}
