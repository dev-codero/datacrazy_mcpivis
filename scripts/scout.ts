// scripts/scout.ts
// Lista pipelines, stages, e conta negocios por stage. NUNCA envia nada.

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";

const cfg = loadConfig();
const mcp = new McpClient(cfg);

interface Pipeline { id: string; name: string; stagesCount?: number }
interface Stage { id: string; name: string; index?: number; pipelineId?: string }
interface Business { id: string; leadId?: string; leadName?: string; stageName?: string; total?: number; status?: string; pipelineName?: string }
interface BusinessListResp { count?: number; data?: Business[] }

async function main() {
  const pipelines = (await mcp.callTool("pipeline_list", {})) as { data?: Pipeline[] };
  console.log("=== PIPELINES ===");
  for (const p of pipelines.data ?? []) {
    console.log(`  ${p.id}  ${p.name}  (${p.stagesCount} stages)`);
  }

  // Junta todas as stages de todas as pipelines
  const allStages: Stage[] = [];
  for (const p of pipelines.data ?? []) {
    const stagesResp = (await mcp.callTool("pipeline_stage_list", { pipelineId: p.id })) as { data?: Stage[] };
    for (const s of stagesResp.data ?? []) {
      allStages.push({ ...s, pipelineId: p.id });
    }
  }

  console.log("\n=== STAGES ===");
  for (const s of allStages) {
    console.log(`  ${s.id}  [${s.index}] ${s.name}  (pipeline=${s.pipelineId})`);
  }

  // Para cada stage, conta negócios
  console.log("\n=== NEGOCIOS POR STAGE ===");
  let total = 0;
  for (const s of allStages) {
    try {
      const r = (await mcp.callTool("business_list_by_stage", { stageId: s.id, take: 100 })) as BusinessListResp;
      const n = r.data?.length ?? 0;
      total += n;
      console.log(`  [${n}] ${s.name}`);
    } catch (e) {
      console.log(`  ERR ${s.name}: ${(e as Error).message}`);
    }
  }
  console.log(`\nTotal: ${total} negocios`);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
