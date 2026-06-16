// scripts/scout-all-stages.ts
// Conta negocios em TODAS as stages da pipeline Vendas e mostra o total real.

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";

const cfg = loadConfig();
const mcp = new McpClient(cfg);

const PIPELINE_VENDAS = "67d29a78-087a-41cd-8b9a-e18053a04758";
const PAGE = 100;

const stages = (await mcp.callTool("pipeline_stage_list", { pipelineId: PIPELINE_VENDAS })) as {
  data?: Array<{ id: string; name: string; index: number }>;
};

console.log("=== STAGES VENDAS ===");
let total = 0;
for (const s of stages.data ?? []) {
  // Pega todos (pagina)
  let stageCount = 0;
  let skip = 0;
  let batch: Array<Record<string, unknown>> = [];
  do {
    const r = (await mcp.callTool("business_list_by_stage", {
      stageId: s.id,
      take: PAGE,
      skip,
    })) as { data?: Array<Record<string, unknown>> };
    batch = r.data ?? [];
    stageCount += batch.length;
    skip += PAGE;
  } while (batch.length === PAGE);
  total += stageCount;
  console.log(`  [${stageCount.toString().padStart(3)}] [${s.index}] ${s.name}  (${s.id})`);
}
console.log(`\nTOTAL: ${total} negocios na pipeline Vendas`);
