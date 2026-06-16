// scripts/inspect-sent.ts
// Mostra os 5 negocios ja enviados: nome, telefone, email, gclid, valor.

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";
import { readFileSync } from "node:fs";

const cfg = loadConfig();
const mcp = new McpClient(cfg);
const state = JSON.parse(readFileSync(".sync-state.json", "utf-8")) as Record<string, unknown>;

function pickPhone(lead: Record<string, unknown>): string | undefined {
  return (lead.rawPhone as string) || (lead.phone as string);
}
function pickGclid(lead: Record<string, unknown>): string | undefined {
  const lc = ["gclid", "wbraid", "gbraid", "pageid"];
  const af = (lead.additionalFields as Array<{ additionalField?: { name?: string }; value?: unknown }>) ?? [];
  for (const f of af) {
    if (lc.includes((f.additionalField?.name ?? "").toLowerCase())) {
      const v = f.value;
      if (v !== null && v !== undefined && v !== "") return String(v);
    }
  }
  return undefined;
}

let i = 1;
for (const businessId of Object.keys(state)) {
  const meta = state[businessId] as { planilha: string; etapa: string; sentAt: string };
  // pega os negocios da stage correspondente
  const stagesResp = (await mcp.callTool("pipeline_stage_list", { pipelineId: "67d29a78-087a-41cd-8b9a-e18053a04758" })) as { data?: Array<{ id: string; name: string }> };
  // Acha o stageId pela etapa
  const stageId = meta.etapa === "Orcamento Enviado"
    ? "cfc192bd-9a14-4a68-8d07-d74a83f7199f"
    : "33b14c90-4d8a-45c8-b98a-12770ead38b6";
  const r = (await mcp.callTool("business_list_by_stage", { stageId, take: 300 })) as { data?: Array<Record<string, unknown>> };
  const b = r.data?.find((x) => String(x.id) === businessId);
  if (!b) {
    console.log(`#${i} ${businessId}  (NAO ACHEI NA STAGE ${stageId})`);
    i++;
    continue;
  }
  const lead = (await mcp.callTool("lead_get", { id: b.leadId as string })) as Record<string, unknown>;
  const af = (lead.additionalFields as Array<{ additionalField?: { name?: string }; value?: unknown }>) ?? [];
  const allFields = af.map((f) => `${f.additionalField?.name}=${f.value}`).join(" | ");

  console.log(`\n#${i} ${businessId}`);
  console.log(`  planilha:   ${meta.planilha}`);
  console.log(`  etapa:      ${meta.etapa}`);
  console.log(`  sentAt:     ${meta.sentAt}`);
  console.log(`  lead.name:  ${lead.name}`);
  console.log(`  telefone:   ${pickPhone(lead) ?? "(VAZIO)"}`);
  console.log(`  email:      ${lead.email || "(vazio)"}`);
  console.log(`  gclid:      ${pickGclid(lead) ?? "(nenhum)"}`);
  console.log(`  valor:      ${b.total}`);
  console.log(`  all fields: ${allFields.slice(0, 200)}`);
  i++;
}
