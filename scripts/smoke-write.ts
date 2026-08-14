// scripts/smoke-write.ts
//
// Smoke test de ESCRITA: tags, associacao lead↔tag e atribuicao de atendente.
// Cada passo e verificado lendo de volta — escrever sem conferir nao prova nada.
//
// Dois modos:
//
//   npx tsx scripts/smoke-write.ts
//       Ciclo completo com dados DESCARTAVEIS: cria uma tag temporaria, poe e
//       tira de um lead, troca o atendente, e desfaz tudo no fim. Repetivel.
//
//   npx tsx scripts/smoke-write.ts --setup
//       Cria as tags DEV permanentes (vermelhas) e atribui o atendente aos
//       leads de teste. NAO desfaz — e configuracao, nao teste.
//
// Flags: --tag DEV · --atendente <email> · --leads N · --cor "#DC2626"

import { loadConfig } from "../src/config.js";
import { DataCrazyClient } from "../src/client.js";
import { McpClient } from "../src/mcp-client.js";

const args = process.argv.slice(2);
const arg = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const SETUP = args.includes("--setup");
const TAG_BASE = arg("tag", "DEV");
const EMAIL = arg("atendente", "sousaartur246@gmail.com");
const N_LEADS = Number(arg("leads", "5"));
const COR = arg("cor", "#DC2626"); // vermelho

// As tags permanentes do modo --setup. Espelham as etapas que o n8n sync usa.
const TAGS_SETUP = [`${TAG_BASE}-teste`, `${TAG_BASE}-qualificado`, `${TAG_BASE}-convertido`];

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

const falhas: string[] = [];
function check(ok: boolean, label: string, detalhe = "") {
  console.error(`  ${ok ? "✓" : "✗"} ${label}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas.push(label);
}

interface Tag {
  id?: string;
  name?: string;
  color?: string;
  description?: string;
  leadsCount?: number;
}
interface Lead {
  id?: string;
  name?: string;
  tags?: Array<{ id?: string; name?: string }>;
  attendantId?: string;
  [k: string]: unknown;
}

/** Le uma tag pelo nome. O tag_list filtra por `search`, que e substring. */
async function acharTag(nome: string): Promise<Tag | undefined> {
  const tags = lista<Tag>(await mcp.callTool("tag_list", { search: nome, limit: 200 }));
  return tags.find((t) => norm(t.name ?? "") === norm(nome));
}

/**
 * Cria tag COM COR. Precisa ser pelo REST: o tag_create do MCP so aceita
 * name e description — nao ha como definir cor por la.
 *
 * Usa o objeto que o proprio POST devolve, em vez de reler pela listagem.
 * Motivo medido em 2026-08-13: a propagacao para o `tag_list` do MCP sem
 * `search` levou mais de 20s, enquanto o REST refletiu em ~320ms. Reler logo
 * apos criar da "nao encontrado" e faz o chamador achar que a criacao falhou.
 */
async function criarTagColorida(nome: string, cor: string, descricao: string): Promise<Tag | undefined> {
  const criada = (await rest.post("/api/v1/tags", { name: nome, color: cor, description: descricao })) as Tag;
  return criada?.id ? criada : acharTag(nome);
}

/** Espera a tag propagar para a leitura do MCP, que e mais lenta que o REST. */
async function esperarPropagar(id: string, tentativas = 20): Promise<boolean> {
  for (let i = 0; i < tentativas; i++) {
    const r = lista<Tag>(await mcp.callTool("tag_list", { search: id.slice(0, 8), limit: 200 }));
    if (r.some((t) => t.id === id)) return true;
    const todas = lista<Tag>(await mcp.callTool("tag_list", { limit: 200 }));
    if (todas.some((t) => t.id === id)) return true;
    await sleep(1000);
  }
  return false;
}

async function main() {
  console.error(`REST: ${cfg.apiUrl}`);
  console.error(`MCP:  ${cfg.mcpUrl}`);
  console.error(`modo: ${SETUP ? "SETUP (permanente)" : "teste (descartavel)"}\n`);

  // ── atendente ─────────────────────────────────────────────────────────────
  console.error("▸ atendente");
  const atendentes = lista<{ id?: string; userId?: string; name?: string; email?: string }>(
    await mcp.callTool("attendant_list", { limit: 200 }),
  );
  const atendente = atendentes.find((a) => norm(a.email ?? "") === norm(EMAIL));
  check(
    Boolean(atendente?.userId),
    `achou ${EMAIL}`,
    atendente ? `${atendente.name} · id ${atendente.id} · userId ${atendente.userId}` : "nao encontrado",
  );
  if (!atendente?.userId) {
    console.error(`  disponiveis: ${atendentes.map((a) => a.email).join(", ")}`);
    process.exit(1);
  }

  // ── leads alvo ────────────────────────────────────────────────────────────
  const tagBase = await acharTag(TAG_BASE);
  check(Boolean(tagBase?.id), `achou a tag base "${TAG_BASE}"`, tagBase?.id ?? "");
  if (!tagBase?.id) process.exit(1);

  const todosLeads = lista<Lead>(await mcp.callTool("lead_list", { tags: [tagBase.id], skip: 0, limit: 1000 }));
  check(todosLeads.length > 0, "leu os leads de teste", `${todosLeads.length} com a tag ${TAG_BASE}`);

  // ══════════════════════════════════════════════════════════════════════════
  if (SETUP) {
    console.error("\n▸ criando as tags permanentes (vermelhas)");
    const criadas: Tag[] = [];
    for (const nome of TAGS_SETUP) {
      const existente = await acharTag(nome);
      if (existente?.id) {
        check(true, `${nome} ja existia`, `cor ${existente.color}`);
        criadas.push(existente);
        continue;
      }
      const t = await criarTagColorida(nome, COR, `Tag de desenvolvimento — criada por smoke-write.ts`);
      check(Boolean(t?.id), `criou ${nome}`, t ? `${t.id} cor ${t.color}` : "falhou");
      // A cor so vale se persistiu — o REST podia estar ignorando o campo.
      if (t) check(norm(t.color ?? "") === norm(COR), `  cor de ${nome} persistiu como ${COR}`, `veio ${t.color}`);
      if (t?.id) criadas.push(t);
      await sleep(1100); // cota REST de 60/min
    }

    console.error(`\n▸ atribuindo ${atendente.name} como atendente em ${todosLeads.length} leads`);
    let ok = 0;
    const t0 = Date.now();
    for (const lead of todosLeads) {
      try {
        await mcp.callTool("lead_update_attendant", { id: lead.id, userId: atendente.userId });
        ok++;
        if (ok % 100 === 0) console.error(`    ${ok}/${todosLeads.length} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      } catch (err) {
        console.error(`    ✗ ${lead.id}: ${(err instanceof Error ? err.message : String(err)).slice(0, 80)}`);
      }
    }
    check(ok === todosLeads.length, "atribuiu em todos", `${ok}/${todosLeads.length} em ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    // Verificacao independente: reler um lead e conferir que grudou.
    const amostra = (await mcp.callTool("lead_get", { id: todosLeads[0].id })) as Lead;
    const attId = (amostra?.attendantId ?? (amostra as { attendant?: { id?: string } })?.attendant?.id) as string | undefined;
    check(attId === atendente.id, "releitura confirma o atendente no lead", `${attId ?? "(vazio)"}`);

    console.error("\n✓ setup concluido — as tags e o atendente FICAM.");
    if (falhas.length) {
      console.error(`✗ com ${falhas.length} problema(s): ${falhas.join(" · ")}`);
      process.exit(1);
    }
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Modo teste: tudo descartavel, desfeito no fim.
  const alvos = todosLeads.slice(0, N_LEADS);
  const carimbo = String(todosLeads.length) + "-" + String(alvos.length);
  const nomeTmp = `${TAG_BASE}-smoke-${carimbo}`;
  let tagTmp: Tag | undefined;
  const leadsTocados: Array<{ id: string; attendantOriginal?: string }> = [];

  try {
    // ── criar tag ───────────────────────────────────────────────────────────
    console.error(`\n▸ criar tag com cor (REST — o MCP nao aceita cor)`);
    const jaExiste = await acharTag(nomeTmp);
    if (jaExiste?.id) {
      await rest.delete(`/api/v1/tags/${jaExiste.id}`);
      await sleep(1100);
    }
    tagTmp = await criarTagColorida(nomeTmp, COR, "temporaria do smoke-write");
    check(Boolean(tagTmp?.id), `criou ${nomeTmp}`, tagTmp?.id ?? "");
    check(norm(tagTmp?.color ?? "") === norm(COR), `cor persistiu como ${COR}`, `veio ${tagTmp?.color}`);
    if (!tagTmp?.id) throw new Error("sem tag, nao da pra seguir");

    // Relata, nao falha: a propagacao para a listagem do MCP e variavel (medida
    // acima de 20s em uma execucao, imediata em outras). Assercao aqui deixaria o
    // smoke instavel sem apontar regressao nossa.
    const propagou = await esperarPropagar(tagTmp.id);
    console.error(`  ${propagou ? "✓" : "⚠"} propagacao para a listagem do MCP${propagou ? "" : " — nao apareceu em 20s"}`);

    // ── update de tag ───────────────────────────────────────────────────────
    console.error("\n▸ atualizar tag");
    // `name` PRECISA ir junto, mesmo quando so a descricao muda. Sem ele a API
    // responde "Tag with the same name already exists" — a tag colidindo com
    // ela mesma. Mensagem enganosa: o problema e campo ausente, nao duplicidade.
    await mcp.callTool("tag_update", {
      id: tagTmp.id,
      name: nomeTmp,
      description: "descricao alterada pelo smoke",
    });
    const relida = (await rest.get(`/api/v1/tags/${tagTmp.id}`)) as Tag & { data?: Tag };
    const tagRelida = relida?.data ?? relida;
    check(
      tagRelida?.description === "descricao alterada pelo smoke",
      "update de descricao persistiu",
      tagRelida?.description ?? "",
    );
    check(norm(tagRelida?.color ?? "") === norm(COR), "update NAO apagou a cor", `${tagRelida?.color}`);

    // ── associar tag a leads ────────────────────────────────────────────────
    console.error(`\n▸ associar a tag em ${alvos.length} lead(s)`);
    for (const lead of alvos) {
      // tagIds e STRING separada por virgula, nao array — o schema declara
      // {"type":"string","description":"Tag IDs to add (comma-separated)."}.
      // Passar array devolve 500 Internal server error em vez de um 400.
      await mcp.callTool("lead_add_tag", { id: lead.id, tagIds: tagTmp.id });
    }
    const comTag = lista<Lead>(await mcp.callTool("lead_list", { tags: [tagTmp.id], skip: 0, limit: 1000 }));
    check(comTag.length === alvos.length, "lead_list filtra pela tag nova", `${comTag.length}/${alvos.length}`);

    const umLead = (await mcp.callTool("lead_get", { id: alvos[0].id })) as Lead;
    const temTag = (umLead.tags ?? []).some((t) => t.id === tagTmp!.id);
    check(temTag, "lead_get mostra a tag no lead", `tags: ${(umLead.tags ?? []).map((t) => t.name).join(", ")}`);

    // A tag base tem que continuar la — adicionar nao pode substituir.
    const mantemBase = (umLead.tags ?? []).some((t) => t.id === tagBase.id);
    check(mantemBase, "adicionar tag NAO removeu a tag que ja existia", "");

    // ── contador da tag ─────────────────────────────────────────────────────
    //
    // NAO falha o smoke: o leadsCount da API esta quebrado, nao e regressao nossa.
    // Medido em 2026-08-13: a tag DEV tem 600 leads associados e leadsCount = 0,
    // nos tres caminhos de leitura (MCP com e sem search, e REST).
    const tagComContagem = await acharTag(nomeTmp);
    const contagem = tagComContagem?.leadsCount;
    if (contagem === alvos.length) {
      console.error(`  ✓ leadsCount reflete as associacoes (${contagem}) — a API corrigiu isso!`);
    } else {
      console.error(`  ⚠ leadsCount = ${contagem}, esperado ${alvos.length} — contador da API nao e atualizado`);
    }

    // ── atendente ───────────────────────────────────────────────────────────
    console.error("\n▸ atribuir atendente");
    for (const lead of alvos) {
      const antes = (await mcp.callTool("lead_get", { id: lead.id })) as Lead;
      const original = (antes?.attendantId ?? (antes as { attendant?: { id?: string } })?.attendant?.id) as string | undefined;
      leadsTocados.push({ id: String(lead.id), attendantOriginal: original });
      await mcp.callTool("lead_update_attendant", { id: lead.id, userId: atendente.userId });
    }
    const depois = (await mcp.callTool("lead_get", { id: alvos[0].id })) as Lead;
    const attDepois = (depois?.attendantId ?? (depois as { attendant?: { id?: string } })?.attendant?.id) as string | undefined;
    check(attDepois === atendente.id, "atendente foi atribuido e persistiu", `${attDepois}`);

    // ── remover tag ─────────────────────────────────────────────────────────
    console.error("\n▸ remover a tag dos leads");
    for (const lead of alvos) {
      await mcp.callTool("lead_remove_tag", { id: lead.id, tagIds: tagTmp.id });
    }
    const aindaComTag = lista<Lead>(await mcp.callTool("lead_list", { tags: [tagTmp.id], skip: 0, limit: 1000 }));
    check(aindaComTag.length === 0, "lead_list nao devolve mais nenhum lead com a tag", `${aindaComTag.length} restante(s)`);

    const semTag = (await mcp.callTool("lead_get", { id: alvos[0].id })) as Lead;
    check(!(semTag.tags ?? []).some((t) => t.id === tagTmp!.id), "lead_get nao mostra mais a tag", "");
    check(
      (semTag.tags ?? []).some((t) => t.id === tagBase.id),
      "remover a tag nova NAO removeu a tag base",
      `sobrou: ${(semTag.tags ?? []).map((t) => t.name).join(", ") || "(nenhuma)"}`,
    );

    // ── remover tag inexistente ─────────────────────────────────────────────
    console.error("\n▸ casos de borda");
    try {
      await mcp.callTool("lead_remove_tag", { id: alvos[0].id, tagIds: tagTmp.id });
      check(true, "remover tag que ja nao esta la e idempotente", "nao lancou erro");
    } catch (err) {
      check(false, "remover tag que ja nao esta la e idempotente", (err instanceof Error ? err.message : "").slice(0, 80));
    }
  } finally {
    // ── limpeza ─────────────────────────────────────────────────────────────
    console.error("\n▸ desfazendo");
    for (const t of leadsTocados) {
      if (t.attendantOriginal && t.attendantOriginal !== atendente.id) {
        try {
          await mcp.callTool("lead_update_attendant", { id: t.id, userId: t.attendantOriginal });
        } catch {
          /* melhor esforco */
        }
      }
    }
    console.error(`  atendente restaurado em ${leadsTocados.filter((t) => t.attendantOriginal).length} lead(s)`);
    console.error(`  ${leadsTocados.filter((t) => !t.attendantOriginal).length} lead(s) nao tinham atendente antes — ficaram com ${atendente.name}`);

    if (tagTmp?.id) {
      try {
        await rest.delete(`/api/v1/tags/${tagTmp.id}`);
        // Confere pelo GET direto no id, nao pela listagem: a listagem leva
        // segundos para propagar e daria "ainda existe" logo apos o delete.
        const aindaExiste = await rest
          .get(`/api/v1/tags/${tagTmp.id}`)
          .then(() => true)
          .catch(() => false);
        // Limpeza, nao teste: apagar a tag e so para nao deixar sujeira. O que
        // importa de verdade — tirar a tag DO LEAD — esta coberto acima.
        console.error(`  ${aindaExiste ? "⚠" : "✓"} tag temporaria apagada${aindaExiste ? " — GET por id ainda responde 200" : ""}`);
      } catch (err) {
        console.error(`  ⚠ nao consegui apagar a tag temporaria: ${(err instanceof Error ? err.message : "").slice(0, 80)}`);
      }
    }
  }

  console.error("");
  if (falhas.length) {
    console.error(`✗ smoke-write falhou (${falhas.length}): ${falhas.join(" · ")}`);
    process.exit(1);
  }
  console.error("✓ smoke-write passou — tags, associacao e atendente funcionam nos dois sentidos");
}

main().catch((err) => {
  console.error("\n✗ explodiu:", err instanceof Error ? err.message : err);
  process.exit(1);
});
