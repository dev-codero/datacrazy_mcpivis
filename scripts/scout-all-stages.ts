// scripts/scout-all-stages.ts
//
// Conta os negocios de TODAS as stages de uma pipeline, paginando ate o fim, e fecha o
// total. READ-ONLY.
//
// Diferenca para scripts/scout.ts: aquele varre o tenant inteiro mas trunca em 100 por
// stage; este e escopado numa pipeline e pagina de verdade, entao o numero fecha. Alem
// disso confere o que foi paginado contra o `count` da API e contra os ids distintos —
// se divergir, e o bug de paginacao (docs/agent/achados-api.md #1).
//
// Pipeline resolvida por NOME em runtime — nada de UUID no codigo. Ver achados-api #5.
//
// Uso:
//   npx tsx scripts/scout-all-stages.ts
//   npx tsx scripts/scout-all-stages.ts --pipeline="Trafego Pago Eduardo"

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";
import { listStages, pipelineNomeFromArgs, resolvePipeline } from "./lib/tenant.js";

const cfg = loadConfig();
const mcp = new McpClient(cfg);

const PAGE = 50; // a API cap take em 50 (mesmo valor do sync-batch.ts)
const PIPELINE_NOME = pipelineNomeFromArgs("MCP DEV");

const pipeline = await resolvePipeline(mcp, PIPELINE_NOME);
const stages = await listStages(mcp, pipeline.id);

console.log(`=== STAGES DE "${pipeline.name}" ===`);
if (!stages.length) console.log("  (nenhuma stage)");

let total = 0;
const alertas: string[] = [];

for (const s of stages) {
  const ids = new Set<string>();
  let devolvidos = 0;
  let skip = 0;
  let count: number | undefined;

  while (true) {
    const r = await mcp.callTool<{ count?: number; data?: Array<{ id: string }> }>(
      "business_list_by_stage",
      { stageId: s.id, take: PAGE, skip },
    );
    count ??= r.count;
    const batch = r.data ?? [];
    devolvidos += batch.length;
    for (const b of batch) ids.add(String(b.id));
    if (batch.length < PAGE) break;
    if (devolvidos >= (count ?? Infinity)) break;
    skip += PAGE;
  }

  total += ids.size;

  let flag = "";
  if (devolvidos !== ids.size) {
    flag = `  ⚠ ${devolvidos - ids.size} duplicados na paginacao`;
    alertas.push(`${s.name}: ${devolvidos} devolvidos, ${ids.size} distintos`);
  } else if (count !== undefined && count !== ids.size) {
    flag = `  ⚠ count da API = ${count}`;
    alertas.push(`${s.name}: count=${count}, paginado=${ids.size}`);
  }

  console.log(`  [${String(ids.size).padStart(4)}] [${s.index ?? "?"}] ${s.name}${flag}`);
}

console.log(`\nTOTAL: ${total} negocios distintos em "${pipeline.name}"`);

if (alertas.length) {
  console.log("\n⚠ divergencias de paginacao (ver docs/agent/achados-api.md #1):");
  for (const a of alertas) console.log(`  ${a}`);
}
