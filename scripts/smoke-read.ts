// scripts/smoke-read.ts
//
// Smoke test READ-ONLY contra o DataCrazy. Nao cria, nao altera, nao apaga nada.
//
// Usa o McpClient e o DataCrazyClient do proprio src/ — entao valida o nosso codigo
// de verdade, nao uma reimplementacao. Se este script passa, os dois caminhos de
// cliente funcionam com o token atual.
//
// O que faz:
//   1. REST  — autentica e lista pipelines
//   2. MCP   — autentica e lista tools
//   3. MCP   — acha a tag informada (default: DEV) e pagina os leads dela
//   4. valida o formato dos leads importados (telefone BR, unicidade, dominio do e-mail)
//
//   npx tsx scripts/smoke-read.ts
//   npx tsx scripts/smoke-read.ts --tag DEV --esperado 600

import { loadConfig } from "../src/config.js";
import { DataCrazyClient } from "../src/client.js";
import { McpClient } from "../src/mcp-client.js";

const args = process.argv.slice(2);
const TAG = args[args.indexOf("--tag") + 1] || "DEV";
const ESPERADO = Number(args[args.indexOf("--esperado") + 1]) || 0;
const PAGINA = 100;

/**
 * Teto do `limit` do lead_list. Medido em 2026-08-13: com 1000 vem tudo,
 * com 1001 vem ZERO — sem erro, sem clamp, so uma lista vazia. Passar do teto
 * parece "nao tem lead nenhum", que e o pior jeito possivel de falhar.
 */
const MAX_LIMIT = 1000;

const falhas: string[] = [];
function check(ok: boolean, label: string, detalhe = "") {
  console.error(`  ${ok ? "✓" : "✗"} ${label}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas.push(label);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Lead {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  [k: string]: unknown;
}

/** O DataCrazy varia entre devolver array cru e { data: [...] }. */
function comoLista<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  const d = (v as { data?: unknown })?.data;
  return Array.isArray(d) ? (d as T[]) : [];
}

async function main() {
  const config = loadConfig();
  const rest = new DataCrazyClient(config);
  const mcp = new McpClient(config);

  console.error(`REST: ${config.apiUrl}`);
  console.error(`MCP:  ${config.mcpUrl}`);
  console.error(`tag alvo: ${TAG}\n`);

  // ── 1. REST ───────────────────────────────────────────────────────────────
  console.error("▸ REST");
  let pipelines: Array<{ id?: string; name?: string }> = [];
  try {
    pipelines = comoLista(await rest.get("/api/v1/pipelines"));
    check(true, "autenticou", `${pipelines.length} pipeline(s)`);
  } catch (err) {
    check(false, "autenticou", err instanceof Error ? err.message : String(err));
  }

  // ── 2. MCP ────────────────────────────────────────────────────────────────
  console.error("\n▸ MCP");
  let tagId: string | undefined;
  try {
    const tags = comoLista<{ id?: string; name?: string }>(await mcp.callTool("tag_list", { search: TAG, limit: 50 }));
    check(true, "autenticou", `${tags.length} tag(s) no filtro "${TAG}"`);

    const exata = tags.find((t) => t.name?.trim().toUpperCase() === TAG.toUpperCase());
    tagId = exata?.id;
    check(Boolean(tagId), `achou a tag "${TAG}"`, tagId ? `id ${tagId}` : `veio: ${tags.map((t) => t.name).join(", ") || "nenhuma"}`);
  } catch (err) {
    check(false, "autenticou", err instanceof Error ? err.message : String(err));
  }

  if (!tagId) {
    console.error("\n✗ sem a tag nao da pra seguir — os leads seriam lidos sem escopo");
    process.exit(1);
  }

  // ── 3. leitura dos leads da tag ───────────────────────────────────────────
  //
  // Lemos numa unica pagina grande, NAO varrendo com skip/limit. Ver a checagem
  // de integridade da paginacao logo abaixo: o skip/limit do lead_list perde
  // registros, entao ele nao serve como fonte de verdade.
  console.error(`\n▸ leads com a tag ${TAG}`);
  const leads = comoLista<Lead>(await mcp.callTool("lead_list", { tags: [tagId], skip: 0, limit: MAX_LIMIT }));

  check(leads.length > 0, "leu os leads", `${leads.length} encontrados`);
  check(
    leads.length < MAX_LIMIT,
    `resultado cabe no teto de ${MAX_LIMIT}`,
    leads.length >= MAX_LIMIT ? "bateu no teto — pode haver leads nao lidos, e a paginacao nao e confiavel" : "",
  );
  const idsUnicos = new Set(leads.map((l) => l.id));
  check(idsUnicos.size === leads.length, "sem ids repetidos na leitura direta", `${leads.length - idsUnicos.size} repetido(s)`);
  if (ESPERADO) check(leads.length === ESPERADO, `total bate com o esperado (${ESPERADO})`, `veio ${leads.length}`);

  // ── 3b. integridade da paginacao (regressao conhecida) ────────────────────
  //
  // Em 2026-08-13 o lead_list perdia ~16% dos registros quando varrido com
  // skip/limit: paginas diferentes devolviam o mesmo id e outros nunca apareciam.
  // 600 leads viravam 505 distintos. A ordem e estavel para um mesmo skip, o que
  // aponta para ordenacao com empates (importacao em lote → timestamps iguais).
  //
  // Esta checagem NAO falha o smoke — ela reporta. Quando o DataCrazy corrigir,
  // o numero bate e a gente pode voltar a paginar com seguranca.
  console.error("\n▸ integridade da paginacao (skip/limit)");
  const vistos = new Set<string>();
  let devolvidos = 0;
  for (let skip = 0; skip < leads.length + PAGINA; skip += PAGINA) {
    const pagina = comoLista<Lead>(await mcp.callTool("lead_list", { tags: [tagId], skip, limit: PAGINA }));
    devolvidos += pagina.length;
    for (const l of pagina) if (l.id) vistos.add(l.id);
    if (pagina.length < PAGINA) break;
    await sleep(300); // gentileza com o gateway
  }
  const perdidos = leads.length - vistos.size;
  if (perdidos === 0) {
    console.error(`  ✓ varredura paginada viu os ${vistos.size} leads — paginacao integra`);
    console.error("    (se isto passar de forma consistente, da pra voltar a paginar em scripts de lote)");
  } else {
    console.error(`  ⚠ varredura paginada devolveu ${devolvidos} registros mas so ${vistos.size} distintos`);
    console.error(`    ${perdidos} lead(s) nunca apareceram — ${((perdidos / leads.length) * 100).toFixed(1)}% de perda`);
    console.error("    NAO pagine lead_list com skip/limit; use uma pagina unica com limit alto");
  }

  // ── 4. validacao do que foi importado ─────────────────────────────────────
  console.error("\n▸ formato dos dados importados");

  const comTelefone = leads.filter((l) => l.phone);
  check(comTelefone.length === leads.length, "todo lead tem telefone", `${leads.length - comTelefone.length} sem`);

  // O CRM pode normalizar (tirar +, espaco, parenteses) — comparamos so os digitos.
  const digitos = (s: string) => s.replace(/\D/g, "");
  const foraDoFormato = comTelefone.filter((l) => !/^55\d{2}9\d{8}$/.test(digitos(String(l.phone))));
  check(
    foraDoFormato.length === 0,
    "telefones em 55+DDD+9+8 digitos",
    foraDoFormato.length ? `${foraDoFormato.length} fora, ex: ${foraDoFormato[0].phone}` : "",
  );

  const telefonesUnicos = new Set(comTelefone.map((l) => digitos(String(l.phone))));
  check(
    telefonesUnicos.size === comTelefone.length,
    "telefones unicos apos a importacao",
    telefonesUnicos.size !== comTelefone.length ? `${comTelefone.length - telefonesUnicos.size} duplicado(s) — o CRM deduplicou?` : "",
  );

  const comEmail = leads.filter((l) => l.email);
  const foraDoDominio = comEmail.filter((l) => !String(l.email).endsWith("@example.com"));
  check(
    foraDoDominio.length === 0,
    "e-mails no dominio de teste",
    foraDoDominio.length ? `${foraDoDominio.length} fora, ex: ${foraDoDominio[0].email}` : "",
  );

  const ddds = [...new Set(comTelefone.map((l) => digitos(String(l.phone)).slice(2, 4)))].sort();
  check(ddds.length > 1, "DDDs variados preservados", ddds.join(", "));

  // Nomes com particula sao o caso que costuma quebrar split de nome/sobrenome.
  const comParticula = leads.filter((l) => / (do|da|dos|das|de) /i.test(String(l.name ?? "")));
  check(comParticula.length > 0, "nomes compostos sobreviveram", `${comParticula.length}, ex: ${comParticula[0]?.name}`);

  // ── 5. cross-check MCP x REST ─────────────────────────────────────────────
  console.error("\n▸ cross-check MCP × REST");
  const amostra = leads[0];
  if (amostra?.id) {
    try {
      const viaRest = (await rest.get(`/api/v1/leads/${amostra.id}`)) as { data?: Lead } & Lead;
      const leadRest = viaRest?.data ?? viaRest;
      check(
        digitos(String(leadRest?.phone ?? "")) === digitos(String(amostra.phone ?? "")),
        "REST e MCP devolvem o mesmo telefone para o mesmo lead",
        `${leadRest?.phone} vs ${amostra.phone}`,
      );
    } catch (err) {
      check(false, "leitura do mesmo lead via REST", err instanceof Error ? err.message : String(err));
    }
  }

  // ── resultado ─────────────────────────────────────────────────────────────
  console.error("");
  if (falhas.length) {
    console.error(`✗ smoke falhou (${falhas.length}): ${falhas.join(" · ")}`);
    process.exit(1);
  }
  console.error(`✓ smoke passou — ${leads.length} leads lidos e validados pelos dois clientes`);
}

main().catch((err) => {
  console.error("✗ smoke explodiu:", err instanceof Error ? err.message : err);
  process.exit(1);
});
