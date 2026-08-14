// scripts/probe-rate-limit.ts
//
// Mede o teto de rate limit do DataCrazy. TODAS as chamadas sao READ-ONLY.
//
// Contexto: a medicao de 2026-06-23 (ver docs/agent/context.md) bateu 20 rps x 30s
// no gateway MCP sem achar teto, e deixou as rotas de banco por medir. Este script
// continua de la, mas contra o REST — que e o que 17 das 18 tools realmente usam.
//
// Fases:
//   A  leve      GET /api/v1/pipelines              mede a cota ate tomar 429
//   B  escopada  GET /api/v1/pipelines/{id}/stages  pipeline resolvida por NOME
//   C  pesada    GET /api/v1/leads?take=100&skip=N  PAGINADA — opt-in via --heavy
//   D  mcp       tools/list no gateway MCP          pula sozinho se o tenant nao tiver MCP
//
// A fase C NAO e escopavel por pipeline (o endpoint /leads nao aceita esse filtro),
// entao ela le leads de producao. Por isso exige --heavy explicito.
//
//   npx tsx scripts/probe-rate-limit.ts
//   npx tsx scripts/probe-rate-limit.ts --pipeline="MCP DEV"
//   npx tsx scripts/probe-rate-limit.ts --heavy

import { config as loadDotenv } from "dotenv";
loadDotenv({ quiet: true });

// IDs sao POR TENANT — resolvemos por nome em runtime. Sobrescreva com --pipeline="<nome>".
const PIPELINE_NOME =
  process.argv.find((a) => a.startsWith("--pipeline="))?.split("=").slice(1).join("=") ?? "MCP DEV";

const args = process.argv.slice(2);
const HEAVY = args.includes("--heavy");
const MAX_RPS = Number(args[args.indexOf("--max-rps") + 1]) || 160;
const STEP_SECONDS = Number(args[args.indexOf("--seconds") + 1]) || 10;

const token = process.env.DATACRAZY_API_TOKEN;
if (!token) {
  console.error("✗ DATACRAZY_API_TOKEN nao definido");
  process.exit(1);
}
const apiUrl = process.env.DATACRAZY_API_URL || "https://api.g1.datacrazy.io";
const mcpUrl = process.env.DATACRAZY_MCP_URL || "https://mcp.g1.datacrazy.io/api/mcp";

const restHeaders = {
  "access-token": token,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

interface StepResult {
  rps: number;
  sent: number;
  ok: number;
  rateLimited: number;
  otherErrors: number;
  p50: number;
  p95: number;
  max: number;
  retryAfter?: string;
  sampleError?: string;
}

/** Dispara `rps` requisicoes por segundo durante `seconds`, sem esperar as anteriores. */
async function burst(makeRequest: (i: number) => Promise<Response>, rps: number, seconds: number): Promise<StepResult> {
  const latencies: number[] = [];
  const inflight: Array<Promise<void>> = [];
  const result: StepResult = { rps, sent: 0, ok: 0, rateLimited: 0, otherErrors: 0, p50: 0, p95: 0, max: 0 };
  let aborted = false;

  const intervalMs = 1000 / rps;
  const total = rps * seconds;

  for (let i = 0; i < total && !aborted; i++) {
    const started = Date.now();
    result.sent++;
    inflight.push(
      makeRequest(i)
        .then(async (res) => {
          latencies.push(Date.now() - started);
          if (res.status === 429) {
            result.rateLimited++;
            result.retryAfter ??= res.headers.get("retry-after") ?? "(sem header)";
            aborted = true; // primeiro 429 encerra o passo
          } else if (!res.ok) {
            result.otherErrors++;
            result.sampleError ??= `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`;
          } else {
            result.ok++;
            await res.arrayBuffer(); // drena o corpo pra medir o custo real
          }
        })
        .catch((err: unknown) => {
          result.otherErrors++;
          result.sampleError ??= err instanceof Error ? err.message : String(err);
        }),
    );
    await sleep(intervalMs);
  }

  await Promise.all(inflight);

  latencies.sort((a, b) => a - b);
  result.p50 = pct(latencies, 0.5);
  result.p95 = pct(latencies, 0.95);
  result.max = latencies.at(-1) ?? 0;
  return result;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);

function report(step: StepResult) {
  const verdict = step.rateLimited > 0 ? "← 429" : step.otherErrors > 0 ? "← erros" : "ok";
  console.error(
    `  ${String(step.rps).padStart(4)} rps │ ${String(step.ok).padStart(5)}/${String(step.sent).padEnd(5)} ok │ ` +
      `p50 ${String(step.p50).padStart(4)}ms  p95 ${String(step.p95).padStart(5)}ms  max ${String(step.max).padStart(5)}ms │ ${verdict}`,
  );
  if (step.retryAfter) console.error(`         retry-after: ${step.retryAfter}`);
  if (step.sampleError) console.error(`         erro: ${step.sampleError}`);
}

/**
 * Mede a COTA: quantas requisicoes passam antes do 429, e quanto dura a janela.
 *
 * Este e o instrumento certo para o REST do DataCrazy, que limita por cota/minuto
 * e nao por taxa. Um ramp de rps nao mede nada aqui — com cota fixa, qualquer rps
 * estoura no mesmo numero de requisicoes, so que mais cedo. Ver a secao de rate
 * limit em docs/agent/context.md.
 */
async function measureQuota(label: string, makeRequest: (i: number) => Promise<Response>, rps: number) {
  console.error(`\n▸ ${label}`);
  console.error(`  mandando a ${rps} rps ate o primeiro 429`);

  const intervalMs = 1000 / rps;
  const started = Date.now();
  const latencies: number[] = [];
  let ok = 0;

  for (let i = 0; i < 500; i++) {
    const t = Date.now();
    let res: Response;
    try {
      res = await makeRequest(i);
    } catch (err) {
      console.error(`  ✗ erro de rede na #${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
    latencies.push(Date.now() - t);

    if (res.status === 429) {
      const elapsed = (Date.now() - started) / 1000;
      const retryAfter = res.headers.get("retry-after");
      latencies.sort((a, b) => a - b);

      console.error(`  429 na requisicao #${i + 1} — ${ok} passaram em ${elapsed.toFixed(1)}s`);
      console.error(`  retry-after: ${retryAfter ?? "(ausente)"}`);
      console.error(`  latencia: p50 ${pct(latencies, 0.5)}ms · p95 ${pct(latencies, 0.95)}ms`);

      const windowSeconds = retryAfter ? elapsed + Number(retryAfter) : null;
      if (windowSeconds) {
        console.error(`  ⇒ cota de ${ok} req por janela de ~${Math.round(windowSeconds)}s`);
        console.error(`  ⇒ taxa sustentavel: ${(ok / windowSeconds).toFixed(2)} rps`);
      } else {
        console.error(`  ⇒ cota de ${ok} req (janela desconhecida — sem retry-after)`);
      }
      return { quota: ok, windowSeconds, retryAfter };
    }

    if (!res.ok) {
      console.error(`  ✗ HTTP ${res.status} na #${i + 1}: ${(await res.text()).slice(0, 120)}`);
      return null;
    }

    ok++;
    await res.arrayBuffer();
    if (ok % 20 === 0) console.error(`    ${ok} ok · ${((Date.now() - started) / 1000).toFixed(1)}s`);
    await sleep(intervalMs);
  }

  console.error(`  ⇒ 500 requisicoes sem 429 — sem cota detectavel a ${rps} rps`);
  return null;
}

/** Compara nomes ignorando caixa, acento e espaco sobrando. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Le as pipelines do tenant para resolver nomes → ids em runtime. */
async function listarPipelines(): Promise<Array<{ id?: string; name?: string }>> {
  const res = await fetch(`${apiUrl}/api/v1/pipelines`, { headers: restHeaders });
  if (!res.ok) {
    console.error(`✗ nao consegui listar pipelines: HTTP ${res.status}`);
    process.exit(1);
  }
  const body = (await res.json()) as unknown;
  if (Array.isArray(body)) return body as Array<{ id?: string; name?: string }>;
  const data = (body as { data?: unknown }).data;
  return Array.isArray(data) ? (data as Array<{ id?: string; name?: string }>) : [];
}

/** Espera a janela de rate limit resetar antes da proxima fase. */
async function cooldown(seconds: number) {
  console.error(`\n  … aguardando ${seconds}s para a janela resetar`);
  await sleep(seconds * 1000);
}

async function main() {
  console.error(`alvo REST: ${apiUrl}`);
  console.error(`passos de ${STEP_SECONDS}s, ramp ate ${MAX_RPS} rps, aborta no primeiro 429`);
  console.error(`fase pesada (leads): ${HEAVY ? "LIGADA (--heavy)" : "desligada"}`);

  // Uma leitura so, para resolver a pipeline por nome sem gastar cota da medicao.
  const pipelinesLidos = await listarPipelines();
  console.error(`pipelines no tenant: ${pipelinesLidos.map((p) => p.name).join(" | ") || "(nenhuma)"}\n`);

  // ── A: rota leve ──────────────────────────────────────────────────────────
  const a = await measureQuota("A · GET /api/v1/pipelines (leve, read-only)", () => fetch(`${apiUrl}/api/v1/pipelines`, { headers: restHeaders }), 3);
  if (a?.retryAfter) await cooldown(Number(a.retryAfter) + 5);

  // ── B: rota escopada na pipeline alvo ─────────────────────────────────────
  // O id vem da fase A: uma leitura ja feita, sem gastar cota extra.
  const alvo = pipelinesLidos.find((p) => norm(p.name ?? "") === norm(PIPELINE_NOME));
  if (!alvo?.id) {
    console.error(`\n▸ B · PULADA — pipeline "${PIPELINE_NOME}" nao encontrada neste tenant`);
    console.error(`      disponiveis: ${pipelinesLidos.map((p) => p.name).join(" | ") || "(nenhuma)"}`);
    console.error(`      use --pipeline="<nome>"`);
  } else {
    const b = await measureQuota(
      `B · GET /api/v1/pipelines/{${alvo.name}}/stages (escopada)`,
      () => fetch(`${apiUrl}/api/v1/pipelines/${alvo.id}/stages`, { headers: restHeaders }),
      3,
    );
    if (b?.retryAfter) await cooldown(Number(b.retryAfter) + 5);
    if (a && b) {
      const veredito =
        a.quota === b.quota ? "mesma cota nas duas rotas — provavelmente global por token" : "cotas diferentes por rota";
      console.error(`\n  ⇒ A=${a.quota} req · B=${b.quota} req → ${veredito}`);
    }
  }

  // ── C: rota pesada paginada ───────────────────────────────────────────────
  if (HEAVY) {
    await measureQuota(
      "C · GET /api/v1/leads?take=100 (pesada, paginada, NAO escopavel por pipeline)",
      (i) => fetch(`${apiUrl}/api/v1/leads?take=100&skip=${(i % 20) * 100}`, { headers: restHeaders }),
      2,
    );
  } else {
    console.error("\n▸ C · rota pesada — PULADA (rode com --heavy para incluir)");
    console.error("      atencao: /api/v1/leads nao aceita filtro por pipeline, entao essa fase");
    console.error("      le leads de producao. Read-only, mas fora do escopo da MCP DEV.");
  }

  // ── D: gateway MCP ────────────────────────────────────────────────────────
  console.error("\n▸ D · gateway MCP (tools/list)");
  const probe = await fetch(mcpUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "probe", version: "1.0.0" } },
    }),
  });
  if (!probe.ok) {
    console.error(`  pulada — o gateway respondeu HTTP ${probe.status}: ${(await probe.text()).slice(0, 120)}`);
    console.error("  (o token atual nao tem MCP habilitado para o tenant)");
  } else {
    console.error("  gateway acessivel — rode a fase MCP manualmente ou estenda este script");
  }

  console.error("\nfim.");
}

main().catch((err) => {
  console.error("✗ probe explodiu:", err);
  process.exit(1);
});
