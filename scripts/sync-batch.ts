// scripts/sync-batch.ts
//
// Sincroniza negocios do DataCrazy → planilha Google via n8n.
// Pagina stages com take=50 + skip += 50 (a API cap take em 50).
// Idempotente: grava IDs ja enviados em .sync-state.json.
//
// 2 stages alvo:
//   - Orcamento    -> NOVA_LUZ_LEAD_QUALIFICADO (etapa=Orcamento Enviado)
//   - Finalizado   -> NOVA_LUZ_LEAD_CONVERTIDO  (etapa=Convertido)
//
// Uso:
//   npx tsx scripts/sync-batch.ts                    # dry-run, ambas stages
//   npx tsx scripts/sync-batch.ts --send             # envia
//   npx tsx scripts/sync-batch.ts --limit=20         # so 20 por stage
//   npx tsx scripts/sync-batch.ts --stage=<id>       # so 1 stage
//   npx tsx scripts/sync-batch.ts --reset            # limpa state, reenvia tudo

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const cfg = loadConfig();
const mcp = new McpClient(cfg);

const PAGE = 50;
const N8N_DELAY_MS = 1100; // ~55 req/min, abaixo do limite de 60 do Google Sheets
const STATE_FILE = join(process.cwd(), ".sync-state.json");

// IDs sao POR TENANT — um UUID hardcoded aqui quebra em silencio em qualquer outro
// tenant ou depois que alguem recria a pipeline. Resolvemos por NOME em runtime.
//
// Sobrescreva com env var ou flag quando os nomes forem outros:
//   SYNC_PIPELINE="Vendas"  npx tsx scripts/sync-batch.ts
//   npx tsx scripts/sync-batch.ts --pipeline="Trafego Pago Eduardo"
const PIPELINE_NOME =
  process.argv.find((a) => a.startsWith("--pipeline="))?.split("=").slice(1).join("=") ??
  process.env.SYNC_PIPELINE ??
  "Vendas";

// Mapeamento por NOME do stage -> {etapa, planilha}.
const STAGE_NOME_TO_PLAN = new Map<string, { etapa: string; planilha: string }>([
  ["Orcamento", { etapa: "Orcamento Enviado", planilha: "NOVA_LUZ_LEAD_QUALIFICADO" }],
  ["Finalizado", { etapa: "Convertido", planilha: "NOVA_LUZ_LEAD_CONVERTIDO" }],
]);

/** Compara nomes ignorando caixa, acento e espaco sobrando. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// === args ===
const args = process.argv.slice(2);
const dryRun = !args.includes("--send");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limitPerStage = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const onlyStages = args.filter((a) => a.startsWith("--stage=")).map((a) => a.split("=")[1]);
const resetState = args.includes("--reset");
const statusFilter = args.find((a) => a.startsWith("--status="))?.split("=")[1];
const batchPauseEvery = Number(args.find((a) => a.startsWith("--batch="))?.split("=")[1] ?? 10);
const batchPauseMs = Number(args.find((a) => a.startsWith("--pause="))?.split("=")[1] ?? 5000);

console.log(`Mode:           ${dryRun ? "DRY-RUN" : "REAL"}`);
console.log(`Pipeline:       ${PIPELINE_NOME} (resolvido em runtime)`);
console.log(`Limit/stage:    ${limitPerStage === Infinity ? "all" : limitPerStage}`);
console.log(`Status filter:  ${statusFilter ?? "(none)"}`);
console.log(`Stages:         ${onlyStages.length ? onlyStages.join(", ") : "Orcamento + Finalizado"}`);
console.log(`Batch:          ${batchPauseEvery} envios + pausa ${batchPauseMs}ms`);
console.log(`State:          ${resetState ? "(resetting)" : STATE_FILE}`);
console.log("");

// === state (idempotencia) ===
type State = Record<string, { etapa: string; planilha: string; sentAt: string }>;
function loadState(): State {
  if (resetState || !existsSync(STATE_FILE)) return {};
  try { return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as State; } catch { return {}; }
}
function saveState(s: State) { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }
const state = loadState();

// === helpers ===
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

async function sendOne(payload: Record<string, unknown>) {
  const res = await fetch(cfg.n8nWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: (await res.text()).slice(0, 200) };
}

async function fetchAllByStage(stageId: string): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = [];
  let skip = 0;
  let realCount: number | undefined;
  while (true) {
    const r = (await mcp.callTool("business_list_by_stage", {
      stageId,
      take: PAGE,
      skip,
    })) as { count?: number; data?: Array<Record<string, unknown>> };
    if (realCount === undefined) realCount = r.count;
    const batch = r.data ?? [];
    all.push(...batch);
    if (batch.length < PAGE) break;
    if (all.length >= (realCount ?? Infinity)) break;
    skip += PAGE;
  }
  return all;
}

interface StageSummary {
  stageName: string;
  etapa: string;
  planilha: string;
  total: number;
  sent: number;
  alreadySent: number;
  skipped: number;
  skipReasons: Record<string, number>;
  elapsed: number;
}

const summaries: StageSummary[] = [];
const t0 = Date.now();

// === resolucao de pipeline e stages por nome ===
//
// Falha ALTO se nao achar. A versao anterior usava UUID fixo: quando a pipeline
// nao existia no tenant, o loop simplesmente nao entrava e o script terminava
// "com sucesso" sem sincronizar nada.
const pipelinesResp = (await mcp.callTool("pipeline_list", { limit: 200 })) as {
  data?: Array<{ id: string; name: string }>;
};
const pipelines = pipelinesResp.data ?? [];
const pipeline = pipelines.find((p) => norm(p.name) === norm(PIPELINE_NOME));

if (!pipeline) {
  console.error(`\n✗ pipeline "${PIPELINE_NOME}" nao existe neste tenant.`);
  console.error(`  disponiveis: ${pipelines.map((p) => p.name).join(" | ") || "(nenhuma)"}`);
  console.error(`  use --pipeline="<nome>" ou a env SYNC_PIPELINE.`);
  process.exit(1);
}
console.log(`Pipeline resolvida: ${pipeline.name} → ${pipeline.id}`);

const stagesResp = (await mcp.callTool("pipeline_stage_list", { pipelineId: pipeline.id, limit: 200 })) as {
  data?: Array<{ id: string; name: string }>;
};
const stages = stagesResp.data ?? [];

// Resolve cada nome configurado para o id real deste tenant.
const alvos: Array<{ stageId: string; stageName: string; plan: { etapa: string; planilha: string } }> = [];
const naoEncontrados: string[] = [];

for (const [nomeConfigurado, plan] of STAGE_NOME_TO_PLAN) {
  const stage = stages.find((s) => norm(s.name) === norm(nomeConfigurado));
  if (stage) alvos.push({ stageId: stage.id, stageName: stage.name, plan });
  else naoEncontrados.push(nomeConfigurado);
}

if (naoEncontrados.length) {
  console.error(`\n✗ stage(s) nao encontrado(s) em "${pipeline.name}": ${naoEncontrados.join(", ")}`);
  console.error(`  stages existentes: ${stages.map((s) => s.name).join(" | ") || "(nenhum)"}`);
  process.exit(1);
}
console.log(`Stages resolvidos:  ${alvos.map((a) => `${a.stageName}→${a.stageId.slice(0, 8)}…`).join("  ")}`);

for (const { stageId, stageName, plan } of alvos) {
  // --stage= continua aceitando id, e agora tambem nome.
  if (onlyStages.length && !onlyStages.some((s) => s === stageId || norm(s) === norm(stageName))) continue;

  console.log(`\n--- ${stageName} -> ${plan.planilha} ---`);
  const allBusinesses = await fetchAllByStage(stageId);
  let toProcess = allBusinesses;
  if (statusFilter) toProcess = toProcess.filter((b) => b.status === statusFilter);
  const slice = limitPerStage === Infinity ? toProcess : toProcess.slice(0, limitPerStage);
  console.log(`  negocios: ${allBusinesses.length}  apos status: ${toProcess.length}  | processando: ${slice.length}`);

  const summary: StageSummary = {
    stageName,
    etapa: plan.etapa,
    planilha: plan.planilha,
    total: slice.length,
    sent: 0,
    alreadySent: 0,
    skipped: 0,
    skipReasons: {},
    elapsed: 0,
  };
  const tStage = Date.now();

  for (const b of slice) {
    const businessId = String(b.id);

    if (state[businessId]) {
      summary.alreadySent++;
      continue;
    }

    const leadId = b.leadId as string | undefined;
    if (!leadId) {
      summary.skipped++;
      summary.skipReasons["sem leadId"] = (summary.skipReasons["sem leadId"] ?? 0) + 1;
      continue;
    }
    const lead = (await mcp.callTool("lead_get", { id: leadId })) as Record<string, unknown>;
    const telefone = pickPhone(lead);
    const payload = {
      etapa: plan.etapa,
      // Strings vazias em vez de null — Sheets rejeita linha sem valor em matchingColumns
      telefone: telefone ?? "",
      nome: (lead.name as string) || "",
      email: (lead.email as string) || "",
      gclid: pickGclid(lead) ?? "",
      // Numéricos: 0 em vez de null
      valor: (b.total as number | undefined) ?? 0,
    };
    if (dryRun) {
      summary.sent++;
      continue;
    }
    const r = await sendOne(payload);
    if (r.status >= 200 && r.status < 300) {
      summary.sent++;
      state[businessId] = { etapa: plan.etapa, planilha: plan.planilha, sentAt: new Date().toISOString() };
    } else {
      summary.skipped++;
      summary.skipReasons[`http ${r.status}`] = (summary.skipReasons[`http ${r.status}`] ?? 0) + 1;
    }
    await new Promise((res) => setTimeout(res, N8N_DELAY_MS));

    // Pausa maior a cada batch (default 10) para o Sheets/CRM respirar
    if (summary.sent % batchPauseEvery === 0) {
      console.log(`    [pausa ${batchPauseMs}ms apos ${summary.sent} envios]`);
      await new Promise((res) => setTimeout(res, batchPauseMs));
    }
  }
  summary.elapsed = Date.now() - tStage;
  summaries.push(summary);
  console.log(
    `  sent=${summary.sent}  already=${summary.alreadySent}  skip=${summary.skipped}  ${summary.elapsed}ms`,
  );
}

if (!dryRun) saveState(state);

console.log("\n\n=== RESUMO FINAL ===");
console.log(
  "stage".padEnd(20) +
    "planilha".padEnd(34) +
    "total".padStart(7) +
    "sent".padStart(7) +
    "already".padStart(9) +
    "skip".padStart(7) +
    "  motivos",
);
for (const s of summaries) {
  console.log(
    s.stageName.padEnd(20) +
      s.planilha.padEnd(34) +
      String(s.total).padStart(7) +
      String(s.sent).padStart(7) +
      String(s.alreadySent).padStart(9) +
      String(s.skipped).padStart(7) +
      "  " +
      Object.entries(s.skipReasons).map(([k, v]) => `${k}:${v}`).join(" "),
  );
}
console.log(`\nState size: ${Object.keys(state).length} ids`);
console.log(`Tempo total: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
