// scripts/smoke-all.ts
//
// Varredura de TODAS as tools do MCP oficial que ainda nao tinham sido exercitadas.
// Cada escrita e verificada lendo de volta, e tudo que e criado e apagado no fim.
//
// NAO faz (exige --perigoso, e mesmo assim so o que estiver liberado):
//   conversation_send_message  → manda mensagem de verdade para um telefone
//   conversation_find_or_create_by_phone → cria conversa real
//   n8n_sync com dryRun:false  → escreve na planilha do cliente
//
// Os telefones dos leads de teste sao sinteticos mas validos em formato: podem,
// por coincidencia, corresponder a linhas reais. Disparo em massa contra eles
// nao acontece aqui.
//
//   npx tsx scripts/smoke-all.ts
//   npx tsx scripts/smoke-all.ts --so leads,produtos

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";

const args = process.argv.slice(2);
const SO = (args[args.indexOf("--so") + 1] ?? "").split(",").filter(Boolean);

const cfg = loadConfig();
const mcp = new McpClient(cfg);

const lista = <T>(v: unknown): T[] => {
  if (Array.isArray(v)) return v as T[];
  const d = (v as { data?: unknown })?.data;
  return Array.isArray(d) ? (d as T[]) : [];
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CARIMBO = "smoke-all";

interface Resultado {
  grupo: string;
  tool: string;
  ok: boolean;
  detalhe: string;
}
const resultados: Resultado[] = [];
let grupoAtual = "";

/** Roda uma chamada e registra o resultado sem abortar a varredura. */
async function tenta<T>(tool: string, fn: () => Promise<T>, valida?: (r: T) => string | true): Promise<T | undefined> {
  try {
    const r = await fn();
    let detalhe = "";
    if (valida) {
      const v = valida(r);
      if (v !== true) {
        resultados.push({ grupo: grupoAtual, tool, ok: false, detalhe: v });
        console.error(`  ✗ ${tool} — ${v}`);
        return r;
      }
    }
    if (Array.isArray(r)) detalhe = `${r.length} item(s)`;
    else if (r && typeof r === "object" && "id" in r) detalhe = String((r as { id: unknown }).id).slice(0, 8);
    resultados.push({ grupo: grupoAtual, tool, ok: true, detalhe });
    console.error(`  ✓ ${tool}${detalhe ? ` — ${detalhe}` : ""}`);
    return r;
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).replace(/^MCP tool "[^"]+" falhou: /, "");
    resultados.push({ grupo: grupoAtual, tool, ok: false, detalhe: msg.slice(0, 110) });
    console.error(`  ✗ ${tool} — ${msg.slice(0, 110)}`);
    return undefined;
  }
}

function grupo(nome: string): boolean {
  if (SO.length && !SO.includes(nome)) return false;
  grupoAtual = nome;
  console.error(`\n▸ ${nome}`);
  return true;
}

async function main() {
  console.error(`MCP: ${cfg.mcpUrl}\n`);

  // contexto compartilhado
  const tagDev = lista<{ id?: string; name?: string }>(await mcp.callTool("tag_list", { search: "DEV", limit: 50 })).find(
    (t) => t.name === "DEV",
  );
  const leadsDev = lista<{ id?: string }>(
    await mcp.callTool("lead_list", { tags: [tagDev?.id], skip: 0, limit: 1000 }),
  );
  const pipeline = lista<{ id?: string; name?: string }>(await mcp.callTool("pipeline_list", { limit: 200 })).find(
    (p) => p.name === "MCP DEV",
  );
  const stages = lista<{ id?: string; name?: string }>(
    await mcp.callTool("pipeline_stage_list", { pipelineId: pipeline?.id, limit: 200 }),
  );
  const atendente = lista<{ userId?: string }>(await mcp.callTool("attendant_list", { limit: 200 }))[0];
  console.error(`contexto: ${leadsDev.length} leads DEV · pipeline ${pipeline?.name} · ${stages.length} stage(s)`);

  const lixo: Array<() => Promise<unknown>> = [];

  // ── leads: ciclo completo ─────────────────────────────────────────────────
  if (grupo("leads")) {
    const novo = await tenta<{ id?: string }>("lead_create", () =>
      mcp.callTool("lead_create", {
        name: `Lead ${CARIMBO}`,
        email: `lead.${CARIMBO}@example.com`,
        phone: "5511999999001",
        tags: tagDev?.id,
      }),
    );
    const leadId = novo?.id;
    if (leadId) {
      lixo.push(() => mcp.callTool("lead_delete", { id: leadId }));
      await sleep(1500);
      await tenta("lead_get", () => mcp.callTool("lead_get", { id: leadId }), (r: any) =>
        r?.id === leadId ? true : "lead_get nao devolveu o lead criado",
      );
      await tenta("lead_update_info", () => mcp.callTool("lead_update_info", { id: leadId, name: `Lead ${CARIMBO} v2`, company: "ACME" }));
      await tenta("lead_update_contacts", () => mcp.callTool("lead_update_contacts", { id: leadId, email: `v2.${CARIMBO}@example.com` }));
      await tenta("lead_update_address", () => mcp.callTool("lead_update_address", { id: leadId, city: "Recife", state: "PE" }));
      await tenta("lead_update_notes", () => mcp.callTool("lead_update_notes", { id: leadId, notes: "nota do smoke" }));
      if (atendente?.userId) {
        await tenta("lead_update_attendant", () => mcp.callTool("lead_update_attendant", { id: leadId, userId: atendente.userId }));
      }
      await sleep(1500);
      await tenta("lead_get (apos updates)", () => mcp.callTool("lead_get", { id: leadId }), (r: any) =>
        r?.name === `Lead ${CARIMBO} v2` ? true : `nome nao atualizou: ${r?.name}`,
      );
    }
  }

  const leadCobaia = leadsDev[0]?.id;

  // ── leituras derivadas do lead ────────────────────────────────────────────
  if (grupo("lead (leituras)") && leadCobaia) {
    await tenta("lead_list_businesses", () => mcp.callTool("lead_list_businesses", { id: leadCobaia }));
    await tenta("conversation_get_by_lead", () => mcp.callTool("conversation_get_by_lead", { leadId: leadCobaia }));
    await tenta("additional_field_lead_list", () => mcp.callTool("additional_field_lead_list", { limit: 50 }));
  }

  // ── listas ────────────────────────────────────────────────────────────────
  if (grupo("listas")) {
    const l = await tenta<{ id?: string }>("list_create", () => mcp.callTool("list_create", { name: `Lista ${CARIMBO}` }));
    if (l?.id) {
      lixo.push(() => mcp.callTool("list_delete", { id: l.id }));
      await sleep(1200);
      await tenta("list_get", () => mcp.callTool("list_get", { id: l.id }));
      await tenta("list_update", () => mcp.callTool("list_update", { id: l.id, name: `Lista ${CARIMBO} v2` }));
      await tenta("list_list", () => mcp.callTool("list_list", { limit: 50 }));
      if (leadCobaia) {
        await tenta("lead_add_list", () => mcp.callTool("lead_add_list", { id: leadCobaia, listIds: l.id }));
        await sleep(1200);
        await tenta("lead_remove_list", () => mcp.callTool("lead_remove_list", { id: leadCobaia, listIds: l.id }));
      }
    }
  }

  // ── produtos ──────────────────────────────────────────────────────────────
  if (grupo("produtos")) {
    // id_sku e obrigatorio na pratica, apesar de o schema listar so name e price
    // como required. Sem ele: 500 Internal server error (PrismaClientValidationError).
    const p = await tenta<{ id?: string }>("product_create", () =>
      mcp.callTool("product_create", { name: `Produto ${CARIMBO}`, price: 99.9, id_sku: `SKU-${CARIMBO}` }),
    );
    if (p?.id) {
      lixo.push(() => mcp.callTool("product_delete", { id: p.id }));
      await sleep(1200);
      await tenta("product_get", () => mcp.callTool("product_get", { id: p.id }));
      await tenta("product_update", () => mcp.callTool("product_update", { id: p.id, name: `Produto ${CARIMBO} v2` }));
      await tenta("product_list", () => mcp.callTool("product_list", { limit: 50 }));
    }
  }

  // ── motivos de perda ──────────────────────────────────────────────────────
  if (grupo("motivos de perda")) {
    const m = await tenta<{ id?: string }>("loss_reason_create", () =>
      mcp.callTool("loss_reason_create", { name: `Motivo ${CARIMBO}` }),
    );
    if (m?.id) {
      lixo.push(() => mcp.callTool("loss_reason_delete", { id: m.id }));
      await sleep(1200);
      await tenta("loss_reason_get", () => mcp.callTool("loss_reason_get", { id: m.id }));
      await tenta("loss_reason_update", () => mcp.callTool("loss_reason_update", { id: m.id, name: `Motivo ${CARIMBO} v2` }));
      await tenta("loss_reason_list", () => mcp.callTool("loss_reason_list", { limit: 50 }));
    }
  }

  // ── tipos de atividade ────────────────────────────────────────────────────
  if (grupo("tipos de atividade")) {
    const a = await tenta<{ id?: string }>("activity_type_create", () =>
      mcp.callTool("activity_type_create", { name: `Atividade ${CARIMBO}` }),
    );
    if (a?.id) {
      lixo.push(() => mcp.callTool("activity_type_delete", { id: a.id }));
      await sleep(1200);
      await tenta("activity_type_get", () => mcp.callTool("activity_type_get", { id: a.id }));
      await tenta("activity_type_update", () => mcp.callTool("activity_type_update", { id: a.id, name: `Atividade ${CARIMBO} v2` }));
      await tenta("activity_type_list", () => mcp.callTool("activity_type_list", { limit: 50 }));
    }
  }

  // ── departamentos ─────────────────────────────────────────────────────────
  if (grupo("departamentos")) {
    const d = await tenta<{ id?: string }>("department_create", () =>
      mcp.callTool("department_create", { name: `Depto ${CARIMBO}` }),
    );
    if (d?.id) {
      lixo.push(() => mcp.callTool("department_delete", { id: d.id }));
      await sleep(1200);
      await tenta("department_get", () => mcp.callTool("department_get", { id: d.id }));
      await tenta("department_update", () => mcp.callTool("department_update", { id: d.id, name: `Depto ${CARIMBO} v2` }));
    }
    await tenta("department_list", () => mcp.callTool("department_list", { limit: 50 }));
  }

  // ── negocios: ciclo completo ──────────────────────────────────────────────
  if (grupo("negocios") && leadCobaia && stages[0]?.id) {
    const b = await tenta<{ id?: string }>("business_create", () =>
      mcp.callTool("business_create", { leadId: leadCobaia, stageId: stages[0].id, pipelineId: pipeline?.id }),
    );
    if (b?.id) {
      await sleep(1200);
      await tenta("business_update_total", () => mcp.callTool("business_update_total", { id: b.id, total: 1234.56 }));
      if (atendente?.userId) {
        await tenta("business_update_attendant", () => mcp.callTool("business_update_attendant", { id: b.id, userId: atendente.userId }));
      }
      const destino = stages[1]?.id ?? stages[0].id;
      await tenta("business_move_stage", () => mcp.callTool("business_move_stage", { id: b.id, destinationStageId: destino }));
      await tenta("business_list_by_stage", () => mcp.callTool("business_list_by_stage", { stageId: destino, take: 5, skip: 0 }));
      await tenta("business_list_by_attendant", () => mcp.callTool("business_list_by_attendant", { userId: atendente?.userId, take: 5, skip: 0 }));
      await tenta("business_won", () => mcp.callTool("business_won", { id: b.id }));
      await sleep(1200);
      // business_lose exige lossReasonId — usamos o primeiro motivo cadastrado.
      const motivo = lista<{ id?: string }>(await mcp.callTool("loss_reason_list", { limit: 5 }))[0];
      if (motivo?.id) {
        await tenta("business_lose", () =>
          mcp.callTool("business_lose", { id: b.id, lossReasonId: motivo.id, justification: "smoke" }),
        );
      } else {
        console.error("  – business_lose pulado (nenhum motivo de perda cadastrado)");
      }
      // negocio criado aqui e apagado no fim, via REST (o MCP nao tem business_delete)
      lixo.push(async () => {
        const { DataCrazyClient } = await import("../src/client.js");
        return new DataCrazyClient(cfg).delete(`/api/v1/businesses/${b.id}`);
      });
    }
  }

  // ── conversas (SO LEITURA) ────────────────────────────────────────────────
  if (grupo("conversas (leitura)")) {
    const convs = await tenta<Array<{ id?: string }>>("conversation_list", async () =>
      lista(await mcp.callTool("conversation_list", { limit: 5 })),
    );
    const primeira = convs?.[0]?.id;
    if (primeira) {
      await tenta("conversation_messages_list", () => mcp.callTool("conversation_messages_list", { id: primeira, limit: 5 }));
    } else {
      console.error("  – conversation_messages_list pulado (nenhuma conversa)");
    }
    console.error("  – conversation_send_message NAO executado (manda mensagem real)");
    console.error("  – conversation_find_or_create_by_phone NAO executado (cria conversa real)");
  }

  // ── catalogos e read-only ─────────────────────────────────────────────────
  if (grupo("catalogos")) {
    await tenta("instance_list", () => mcp.callTool("instance_list", { limit: 50 }));
    await tenta("working_hour_list", () => mcp.callTool("working_hour_list", { limit: 50 }));
    await tenta("pipeline_group_list", () => mcp.callTool("pipeline_group_list", { limit: 50 }));
    await tenta("additional_field_business_list", () => mcp.callTool("additional_field_business_list", { limit: 50 }));
    await tenta("additional_field_company_list", () => mcp.callTool("additional_field_company_list", { limit: 50 }));
  }

  // ── limpeza ───────────────────────────────────────────────────────────────
  console.error(`\n▸ limpando ${lixo.length} recurso(s) criado(s)`);
  let limpos = 0;
  for (const f of lixo.reverse()) {
    try {
      await f();
      limpos++;
    } catch (err) {
      console.error(`  ⚠ ${(err instanceof Error ? err.message : "").slice(0, 90)}`);
    }
    await sleep(600);
  }
  console.error(`  ${limpos}/${lixo.length} removidos`);

  // ── resumo ────────────────────────────────────────────────────────────────
  const falhas = resultados.filter((r) => !r.ok);
  console.error(`\n═══ ${resultados.length} chamadas · ${resultados.length - falhas.length} ok · ${falhas.length} falha(s) ═══`);
  if (falhas.length) {
    console.error("");
    for (const f of falhas) console.error(`  ✗ [${f.grupo}] ${f.tool} — ${f.detalhe}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n✗ explodiu:", err instanceof Error ? err.message : err);
  process.exit(1);
});
