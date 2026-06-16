// scripts/list-sem-telefone.ts
// Lista os business IDs do Finalizado que nao tem telefone (podem ser os que somem da planilha)

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";

const cfg = loadConfig();
const mcp = new McpClient(cfg);
const STAGE = "33b14c90-4d8a-45c8-b98a-12770ead38b6";
const PAGE = 50;

function pickPhone(lead: Record<string, unknown>): string | undefined {
  return (lead.rawPhone as string) || (lead.phone as string);
}

const all: Array<Record<string, unknown>> = [];
let skip = 0;
while (true) {
  const r = (await mcp.callTool("business_list_by_stage", { stageId: STAGE, take: PAGE, skip })) as {
    data?: Array<Record<string, unknown>>;
  };
  const batch = r.data ?? [];
  all.push(...batch);
  if (batch.length < PAGE) break;
  skip += PAGE;
}

console.log(`Total: ${all.length} negocios na stage Finalizado\n`);

const semTel: Array<{ id: string; name?: string }> = [];
for (const b of all) {
  const lead = (await mcp.callTool("lead_get", { id: b.leadId as string })) as Record<string, unknown>;
  if (!pickPhone(lead)) {
    semTel.push({ id: String(b.id), name: lead.name as string });
  }
}

console.log(`Sem telefone: ${semTel.length}\n`);
for (const s of semTel.slice(0, 30)) {
  console.log(`  ${s.id}  ${s.name}`);
}
if (semTel.length > 30) console.log(`  ... e mais ${semTel.length - 30}`);
