// scripts/probe-write-throughput.ts
//
// Mede a taxa de ESCRITA: cria negocios via MCP e apaga via REST, cronometrando os dois.
//
// Responde a pergunta "criar N negocios pelo MCP e mais rapido que pelo REST?" com
// numero medido, em vez de extrapolar do rate limit de tools/list (rota protocolar,
// que nao toca banco — ver docs/agent/api-datacrazy.md).
//
// SEGURANCA:
//   - so opera em leads que tenham a tag alvo (default DEV)
//   - so cria na pipeline alvo (default "MCP DEV"), resolvida por NOME
//   - grava os ids criados em tmp/negocios-criados.json ANTES de seguir, para que
//     a limpeza sobreviva a uma interrupcao (Ctrl-C, queda de rede, 429)
//   - apaga tudo que criou, a menos que --keep
//
//   npx tsx scripts/probe-write-throughput.ts --n 20
//   npx tsx scripts/probe-write-throughput.ts --n 500
//   npx tsx scripts/probe-write-throughput.ts --limpar   # so limpa o que ficou pendente

import { loadConfig } from "../src/config.js";
import { DataCrazyClient } from "../src/client.js";
import { McpClient } from "../src/mcp-client.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const arg = (nome: string, padrao: string) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
};

const N = Number(arg("n", "20"));
const PIPELINE_NOME = arg("pipeline", "MCP DEV");
const TAG_NOME = arg("tag", "DEV");
const KEEP = args.includes("--keep");
const SO_LIMPAR = args.includes("--limpar");

const TMP = fileURLToPath(new URL("../tmp", import.meta.url));
const PENDENTES = `${TMP}/negocios-criados.json`;

const cfg = loadConfig();
const rest = new DataCrazyClient(cfg);
const mcp = new McpClient(cfg);

const lista = <T>(v: unknown): T[] => {
  if (Array.isArray(v)) return v as T[];
  const d = (v as { data?: unknown })?.data;
  return Array.isArray(d) ? (d as T[]) : [];
};
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function lerPendentes(): string[] {
  if (!existsSync(PENDENTES)) return [];
  try {
    return JSON.parse(readFileSync(PENDENTES, "utf8")) as string[];
  } catch {
    return [];
  }
}
function gravarPendentes(ids: string[]) {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(PENDENTES, JSON.stringify(ids, null, 2));
}

/**
 * Apaga negocios pelo REST, respeitando o Retry-After no 429.
 * O REST e o unico caminho: o MCP nao expoe business_delete.
 */
async function apagar(ids: string[]): Promise<{ apagados: number; falhas: number; segundos: number }> {
  const t0 = Date.now();
  let apagados = 0;
  let falhas = 0;
  const restantes = [...ids];

  while (restantes.length) {
    const id = restantes[0];
    try {
      await rest.delete(`/api/v1/businesses/${id}`);
      apagados++;
      restantes.shift();
      gravarPendentes(restantes); // persiste a cada passo — sobrevive a interrupcao
      if (apagados % 25 === 0) {
        console.error(`    ${apagados}/${ids.length} apagados · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) {
        // Cota de 60/min estourou — espera a janela virar e tenta o mesmo id de novo.
        console.error(`    429 apos ${apagados} — aguardando 62s para a janela resetar`);
        await sleep(62_000);
        continue;
      }
      console.error(`    ✗ falha ao apagar ${id}: ${msg.slice(0, 100)}`);
      falhas++;
      restantes.shift();
      gravarPendentes(restantes);
    }
    await sleep(950); // ~1 rps: abaixo da cota de 60/min do REST
  }

  return { apagados, falhas, segundos: (Date.now() - t0) / 1000 };
}

async function main() {
  // ── modo limpeza ──────────────────────────────────────────────────────────
  if (SO_LIMPAR) {
    const pendentes = lerPendentes();
    if (!pendentes.length) {
      console.error("nada pendente em tmp/negocios-criados.json");
      return;
    }
    console.error(`limpando ${pendentes.length} negocio(s) pendente(s) via REST…`);
    const r = await apagar(pendentes);
    console.error(`✓ ${r.apagados} apagados, ${r.falhas} falha(s), ${r.segundos.toFixed(1)}s`);
    return;
  }

  const pendentes = lerPendentes();
  if (pendentes.length) {
    console.error(`⚠ ${pendentes.length} negocio(s) de uma execucao anterior ainda nao foram apagados.`);
    console.error("  rode com --limpar antes de criar mais.");
    process.exit(1);
  }

  // ── resolucao por nome ────────────────────────────────────────────────────
  const pipelines = lista<{ id?: string; name?: string }>(await mcp.callTool("pipeline_list", { limit: 200 }));
  const pipeline = pipelines.find((p) => norm(p.name ?? "") === norm(PIPELINE_NOME));
  if (!pipeline?.id) {
    console.error(`✗ pipeline "${PIPELINE_NOME}" nao existe.`);
    console.error(`  disponiveis: ${pipelines.map((p) => p.name).join(" | ")}`);
    process.exit(1);
  }

  const stages = lista<{ id?: string; name?: string }>(
    await mcp.callTool("pipeline_stage_list", { pipelineId: pipeline.id, limit: 200 }),
  );
  const stage = stages[0];
  if (!stage?.id) {
    console.error(`✗ a pipeline "${pipeline.name}" nao tem stages.`);
    process.exit(1);
  }

  const tags = lista<{ id?: string; name?: string }>(await mcp.callTool("tag_list", { search: TAG_NOME, limit: 50 }));
  const tag = tags.find((t) => norm(t.name ?? "") === norm(TAG_NOME));
  if (!tag?.id) {
    console.error(`✗ tag "${TAG_NOME}" nao encontrada — sem ela nao da pra escopar nos leads de teste.`);
    process.exit(1);
  }

  const leads = lista<{ id?: string; name?: string }>(
    await mcp.callTool("lead_list", { tags: [tag.id], skip: 0, limit: 1000 }),
  );
  if (leads.length < N) {
    console.error(`✗ so ${leads.length} lead(s) com a tag ${TAG_NOME}, preciso de ${N}.`);
    process.exit(1);
  }

  console.error(`pipeline: ${pipeline.name}`);
  console.error(`stage:    ${stage.name}`);
  console.error(`tag:      ${tag.name} (${leads.length} leads disponiveis)`);
  console.error(`criando:  ${N} negocio(s)\n`);

  // ── criacao via MCP ───────────────────────────────────────────────────────
  console.error("▸ criando via MCP");
  const criados: string[] = [];
  const t0 = Date.now();
  let erros = 0;

  for (let i = 0; i < N; i++) {
    try {
      const r = (await mcp.callTool("business_create", {
        leadId: leads[i].id,
        stageId: stage.id,
        pipelineId: pipeline.id,
      })) as { id?: string; data?: { id?: string } };
      const id = r?.id ?? r?.data?.id;
      if (id) {
        criados.push(id);
        gravarPendentes(criados); // persiste ANTES de seguir
      } else {
        erros++;
      }
    } catch (err) {
      erros++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ #${i + 1}: ${msg.slice(0, 120)}`);
      if (msg.includes("429")) {
        console.error("    → o MCP TAMBEM limita escrita. Parando aqui.");
        break;
      }
    }
    if ((i + 1) % 25 === 0) {
      console.error(`    ${criados.length}/${i + 1} criados · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
  }

  const segCriacao = (Date.now() - t0) / 1000;
  const taxaCriacao = criados.length / segCriacao;
  console.error(`\n  ✓ ${criados.length} criados em ${segCriacao.toFixed(1)}s`);
  console.error(`  taxa: ${taxaCriacao.toFixed(2)} negocios/s  (${(taxaCriacao * 60).toFixed(0)}/min)`);
  if (erros) console.error(`  erros: ${erros}`);

  // ── limpeza via REST ──────────────────────────────────────────────────────
  if (KEEP) {
    console.error(`\n▸ --keep: os ${criados.length} negocios FICARAM.`);
    console.error(`  para apagar depois: npx tsx scripts/probe-write-throughput.ts --limpar`);
    return;
  }

  console.error(`\n▸ apagando via REST (unico caminho — o MCP nao tem business_delete)`);
  const r = await apagar(criados);
  const taxaDelecao = r.apagados / r.segundos;
  console.error(`\n  ✓ ${r.apagados} apagados em ${r.segundos.toFixed(1)}s`);
  console.error(`  taxa: ${taxaDelecao.toFixed(2)} negocios/s  (${(taxaDelecao * 60).toFixed(0)}/min)`);
  if (r.falhas) console.error(`  falhas: ${r.falhas} — rode --limpar`);

  // ── veredito ──────────────────────────────────────────────────────────────
  console.error("\n═══ resultado ═══");
  console.error(`  criar  (MCP):  ${taxaCriacao.toFixed(2)}/s  → ${N} levaria ${(N / taxaCriacao / 60).toFixed(1)} min`);
  console.error(`  apagar (REST): ${taxaDelecao.toFixed(2)}/s  → ${N} levaria ${(N / taxaDelecao / 60).toFixed(1)} min`);
  console.error(`  razao: MCP e ${(taxaCriacao / taxaDelecao).toFixed(1)}x mais rapido que o REST`);
}

main().catch((err) => {
  console.error("\n✗ explodiu:", err instanceof Error ? err.message : err);
  const p = lerPendentes();
  if (p.length) console.error(`⚠ ${p.length} negocio(s) criados e NAO apagados — rode --limpar`);
  process.exit(1);
});
