// scripts/scout-pipelines.ts
// Lista pipelines + stages + negocios + leads, sem enviar nada.

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";

const cfg = loadConfig();
const mcp = new McpClient(cfg);

async function main() {
  console.log("=== 1) PIPELINES ===");
  const pipelines = (await mcp.callTool("pipeline_list", {})) as {
    data?: Array<{ id: string; name: string; stagesCount?: number }>;
  };
  for (const p of pipelines.data ?? []) {
    console.log(`  ${p.id}  ${p.name}  (${p.stagesCount} stages)`);
  }

  for (const p of pipelines.data ?? []) {
    console.log(`\n=== 2) STAGES da pipeline "${p.name}" ===`);
    const stages = (await mcp.callTool("pipeline_stages_list", { pipelineId: p.id })) as {
      data?: Array<{ id: string; name: string; index?: number }>;
    };
    for (const s of stages.data ?? []) {
      console.log(`  ${s.id}  [${s.index}] ${s.name}`);
    }

    // Pega negócios da pipeline. Como não temos tool "list businesses by pipeline" óbvio,
    // tentamos business_list_by_pipeline se existir; senão business_list geral.
    console.log(`\n=== 3) NEGÓCIOS da pipeline "${p.name}" ===`);
    let businesses: Array<Record<string, unknown>> = [];
    try {
      const res = (await mcp.callTool("business_list_by_pipeline", { pipelineId: p.id })) as {
        data?: Array<Record<string, unknown>>;
      };
      businesses = res.data ?? [];
      console.log(`  (via business_list_by_pipeline) ${businesses.length} negocios`);
    } catch {
      console.log("  business_list_by_pipeline nao existe nesse MCP — vou usar outro caminho");
    }

    // Pega os primeiros 5 leads de amostra pra inspecionar shape
    console.log(`\n=== 4) AMOSTRA de leads (5 primeiros) ===`);
    const leadsSample = (await mcp.callTool("lead_list", { take: 5 })) as {
      data?: Array<Record<string, unknown>>;
    };
    for (const l of leadsSample.data ?? []) {
      const af = (l.additionalFields as Array<{ additionalField?: { name?: string }; value?: unknown }>) ?? [];
      const gclid = af.find((f) =>
        ["gclid", "wbraid", "gbraid", "pageid"].includes(
          (f.additionalField?.name ?? "").toLowerCase(),
        ),
      );
      console.log(
        `  ${l.id}  ${l.name}  phone=${l.phone}  email=${l.email || "(vazio)"}  gclid=${gclid?.value ?? "(nenhum)"}`,
      );
    }
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
