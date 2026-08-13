// scripts/scout-batches.ts
//
// Amostra os primeiros N negocios de cada stage de uma pipeline e mostra os campos que
// o sync-batch consome: telefone, email, gclid e valor. READ-ONLY, nao envia nada.
//
// Serve de pre-voo do sync-batch: antes de sincronizar uma pipeline, ver se os leads
// tem telefone/gclid preenchidos ou se a planilha vai chegar cheia de buraco.
//
// Pipeline e stages sao resolvidos por NOME em runtime — nada de UUID no codigo.
// Ver docs/agent/achados-api.md secao 5.
//
// Uso:
//   npx tsx scripts/scout-batches.ts                                # todas as stages, 5 por stage
//   npx tsx scripts/scout-batches.ts --pipeline="Trafego Pago Eduardo"
//   npx tsx scripts/scout-batches.ts --stage=Orcamento --stage=Finalizado
//   npx tsx scripts/scout-batches.ts --sample=10

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";
import {
  listStages,
  pipelineNomeFromArgs,
  resolvePipeline,
  resolveStages,
  type Stage,
} from "./lib/tenant.js";

const cfg = loadConfig();
const mcp = new McpClient(cfg);

const args = process.argv.slice(2);
const PIPELINE_NOME = pipelineNomeFromArgs("MCP DEV");
const stageFiltros = args
  .filter((a) => a.startsWith("--stage="))
  .map((a) => a.split("=").slice(1).join("="));
const SAMPLE = Number(args.find((a) => a.startsWith("--sample="))?.split("=")[1] ?? 5);

const GCLID_FIELDS = ["gclid", "wbraid", "gbraid", "pageid"];

function pickPhone(lead: Record<string, unknown>): string | undefined {
  return (lead.rawPhone as string) || (lead.phone as string);
}

function pickGclid(lead: Record<string, unknown>): string | undefined {
  const af =
    (lead.additionalFields as Array<{ additionalField?: { name?: string }; value?: unknown }>) ?? [];
  for (const f of af) {
    if (GCLID_FIELDS.includes((f.additionalField?.name ?? "").toLowerCase())) {
      const v = f.value;
      if (v !== null && v !== undefined && v !== "") return String(v);
    }
  }
  return undefined;
}

const pipeline = await resolvePipeline(mcp, PIPELINE_NOME);
const stages = await listStages(mcp, pipeline.id);
const alvos: Stage[] = stageFiltros.length
  ? resolveStages(stages, stageFiltros, pipeline.name)
  : stages;

console.log(`Pipeline: ${pipeline.name} → ${pipeline.id}`);
console.log(`Stages:   ${alvos.map((s) => s.name).join(" | ") || "(nenhuma)"}`);
console.log(`Amostra:  ${SAMPLE} por stage`);

for (const stage of alvos) {
  const r = await mcp.callTool<{ count?: number; data?: Array<Record<string, unknown>> }>(
    "business_list_by_stage",
    { stageId: stage.id, take: SAMPLE },
  );
  const data = r.data ?? [];

  console.log(`\n=== ${stage.name} — ${r.count ?? "?"} negocios, amostrando ${data.length} ===`);
  if (!data.length) continue;

  for (const b of data) {
    const leadId = b.leadId as string | undefined;
    if (!leadId) {
      console.log(`  biz=${b.id}  (sem leadId)`);
      continue;
    }
    const lead = await mcp.callTool<Record<string, unknown>>("lead_get", { id: leadId });
    console.log(
      `  biz=${b.id}  lead=${lead.name}  phone=${pickPhone(lead) ?? "(VAZIO)"}  ` +
        `email=${lead.email || "(vazio)"}  gclid=${pickGclid(lead) ?? "(nenhum)"}  ` +
        `total=${b.total ?? "(nenhum)"}`,
    );
  }
}
