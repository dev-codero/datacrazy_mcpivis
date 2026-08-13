// scripts/inspect-sent.ts
//
// Auditoria do .sync-state.json: para cada negocio ja enviado ao n8n, mostra o que o
// sync-batch mandou (nome, telefone, email, gclid, valor). READ-ONLY, nao reenvia nada.
//
// Espelha a config do sync-batch.ts: mesma pipeline (--pipeline= / SYNC_PIPELINE) e os
// mesmos nomes de stage. Se mudar o mapeamento la, mude aqui junto.
//
// Pipeline e stages resolvidos por NOME em runtime — nada de UUID no codigo.
// Ver docs/agent/achados-api.md secao 5.
//
// Uso:
//   npx tsx scripts/inspect-sent.ts                       # os 10 primeiros do state
//   npx tsx scripts/inspect-sent.ts --limit=50
//   npx tsx scripts/inspect-sent.ts --limit=all
//   npx tsx scripts/inspect-sent.ts --pipeline="Trafego Pago Eduardo"

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  listStages,
  norm,
  pipelineNomeFromArgs,
  resolvePipeline,
  type Stage,
} from "./lib/tenant.js";

const cfg = loadConfig();
const mcp = new McpClient(cfg);

const PAGE = 50;
const STATE_FILE = join(process.cwd(), ".sync-state.json");
const PIPELINE_NOME = pipelineNomeFromArgs("Vendas");

const limitArg = process.argv.slice(2).find((a) => a.startsWith("--limit="))?.split("=")[1];
const LIMIT = limitArg === "all" ? Infinity : Number(limitArg ?? 10);

// etapa gravada no state -> nome da stage. Espelha o STAGE_NOME_TO_PLAN do sync-batch.ts.
const ETAPA_TO_STAGE_NOME = new Map<string, string>([
  ["Orcamento Enviado", "Orcamento"],
  ["Convertido", "Finalizado"],
]);

interface StateEntry {
  planilha: string;
  etapa: string;
  sentAt: string;
}

if (!existsSync(STATE_FILE)) {
  console.error(`✗ ${STATE_FILE} nao existe — nada foi enviado ainda (o arquivo e gitignored).`);
  process.exit(1);
}
const state = JSON.parse(readFileSync(STATE_FILE, "utf-8")) as Record<string, StateEntry>;
const businessIds = Object.keys(state);

console.log(`State:    ${businessIds.length} negocios enviados`);
console.log(`Exibindo: ${LIMIT === Infinity ? "todos" : LIMIT}`);

const pipeline = await resolvePipeline(mcp, PIPELINE_NOME);
const stages = await listStages(mcp, pipeline.id);
console.log(`Pipeline: ${pipeline.name} → ${pipeline.id}\n`);

function pickPhone(lead: Record<string, unknown>): string | undefined {
  return (lead.rawPhone as string) || (lead.phone as string);
}

function pickGclid(lead: Record<string, unknown>): string | undefined {
  const lc = ["gclid", "wbraid", "gbraid", "pageid"];
  const af =
    (lead.additionalFields as Array<{ additionalField?: { name?: string }; value?: unknown }>) ?? [];
  for (const f of af) {
    if (lc.includes((f.additionalField?.name ?? "").toLowerCase())) {
      const v = f.value;
      if (v !== null && v !== undefined && v !== "") return String(v);
    }
  }
  return undefined;
}

/** Le a stage inteira uma vez so e guarda em cache — o state tem centenas de ids. */
const cache = new Map<string, Map<string, Record<string, unknown>>>();
async function businessesDaStage(stage: Stage): Promise<Map<string, Record<string, unknown>>> {
  const cached = cache.get(stage.id);
  if (cached) return cached;

  const porId = new Map<string, Record<string, unknown>>();
  let skip = 0;
  while (true) {
    const r = await mcp.callTool<{ data?: Array<Record<string, unknown>> }>(
      "business_list_by_stage",
      { stageId: stage.id, take: PAGE, skip },
    );
    const batch = r.data ?? [];
    for (const b of batch) porId.set(String(b.id), b);
    if (batch.length < PAGE) break;
    skip += PAGE;
  }
  cache.set(stage.id, porId);
  return porId;
}

let i = 0;
const naoAchados: string[] = [];

for (const businessId of businessIds) {
  if (i >= LIMIT) break;
  i++;
  const meta = state[businessId];

  const stageNome = ETAPA_TO_STAGE_NOME.get(meta.etapa);
  if (!stageNome) {
    console.log(`\n#${i} ${businessId}`);
    console.log(`  ✗ etapa "${meta.etapa}" nao esta no mapa — atualize ETAPA_TO_STAGE_NOME`);
    continue;
  }

  const stage = stages.find((s) => norm(s.name) === norm(stageNome));
  if (!stage) {
    console.log(`\n#${i} ${businessId}`);
    console.log(`  ✗ stage "${stageNome}" nao existe em "${pipeline.name}"`);
    console.log(`    stages: ${stages.map((s) => s.name).join(" | ") || "(nenhuma)"}`);
    continue;
  }

  const b = (await businessesDaStage(stage)).get(businessId);
  if (!b) {
    naoAchados.push(businessId);
    console.log(`\n#${i} ${businessId}  (nao esta mais na stage ${stage.name} — pode ter movido)`);
    continue;
  }

  const lead = await mcp.callTool<Record<string, unknown>>("lead_get", { id: b.leadId as string });
  const af =
    (lead.additionalFields as Array<{ additionalField?: { name?: string }; value?: unknown }>) ?? [];

  console.log(`\n#${i} ${businessId}`);
  console.log(`  planilha:   ${meta.planilha}`);
  console.log(`  etapa:      ${meta.etapa}  (stage ${stage.name})`);
  console.log(`  sentAt:     ${meta.sentAt}`);
  console.log(`  lead.name:  ${lead.name}`);
  console.log(`  telefone:   ${pickPhone(lead) ?? "(VAZIO)"}`);
  console.log(`  email:      ${lead.email || "(vazio)"}`);
  console.log(`  gclid:      ${pickGclid(lead) ?? "(nenhum)"}`);
  console.log(`  valor:      ${b.total}`);
  console.log(
    `  all fields: ${af.map((f) => `${f.additionalField?.name}=${f.value}`).join(" | ").slice(0, 200)}`,
  );
}

if (naoAchados.length) {
  console.log(`\n⚠ ${naoAchados.length} negocio(s) do state nao estao mais na stage esperada.`);
}
