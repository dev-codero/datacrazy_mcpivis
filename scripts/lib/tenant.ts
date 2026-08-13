// scripts/lib/tenant.ts
//
// Resolucao de pipeline/stage por NOME em runtime, para os scripts de scout/auditoria.
//
// IDs de pipeline e stage sao POR TENANT. Qualquer UUID fixo no codigo quebra em outro
// tenant — ou depois que alguem recria a pipeline — e quebra EM SILENCIO: a listagem
// volta vazia, o loop nao entra, o script termina "com sucesso" sem ter feito nada.
// Por isso tudo aqui falha ALTO (exit 1) listando o que existe de verdade.
//
// Ver docs/agent/achados-api.md secao 5.

import type { McpClient } from "../../src/mcp-client.js";

export interface Pipeline {
  id: string;
  name: string;
}

export interface Stage {
  id: string;
  name: string;
  index?: number;
}

/** Compara nomes ignorando caixa, acento e espaco sobrando. */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Nome da pipeline alvo: `--pipeline="<nome>"` > env `SYNC_PIPELINE` > default do script.
 */
export function pipelineNomeFromArgs(fallback: string): string {
  return (
    process.argv.find((a) => a.startsWith("--pipeline="))?.split("=").slice(1).join("=") ??
    process.env.SYNC_PIPELINE ??
    fallback
  );
}

/** Resolve a pipeline pelo nome. Sai com exit 1 listando as disponiveis se nao achar. */
export async function resolvePipeline(mcp: McpClient, nome: string): Promise<Pipeline> {
  const resp = await mcp.callTool<{ data?: Pipeline[] }>("pipeline_list", { limit: 200 });
  const pipelines = resp.data ?? [];
  const found = pipelines.find((p) => norm(p.name) === norm(nome));
  if (!found) {
    console.error(`\n✗ pipeline "${nome}" nao existe neste tenant.`);
    console.error(`  disponiveis: ${pipelines.map((p) => p.name).join(" | ") || "(nenhuma)"}`);
    console.error(`  use --pipeline="<nome>" ou a env SYNC_PIPELINE.`);
    process.exit(1);
  }
  return found;
}

/** Lista as stages de uma pipeline. */
export async function listStages(mcp: McpClient, pipelineId: string): Promise<Stage[]> {
  const resp = await mcp.callTool<{ data?: Stage[] }>("pipeline_stage_list", {
    pipelineId,
    limit: 200,
  });
  return resp.data ?? [];
}

/**
 * Resolve nomes (ou ids) de stage contra as stages da pipeline.
 * Sai com exit 1 listando as existentes se algum nao for encontrado.
 */
export function resolveStages(stages: Stage[], nomes: string[], pipelineNome: string): Stage[] {
  const achados: Stage[] = [];
  const faltando: string[] = [];

  for (const nome of nomes) {
    const stage = stages.find((s) => s.id === nome || norm(s.name) === norm(nome));
    if (stage) achados.push(stage);
    else faltando.push(nome);
  }

  if (faltando.length) {
    console.error(`\n✗ stage(s) nao encontrado(s) em "${pipelineNome}": ${faltando.join(", ")}`);
    console.error(`  stages existentes: ${stages.map((s) => s.name).join(" | ") || "(nenhum)"}`);
    process.exit(1);
  }
  return achados;
}
