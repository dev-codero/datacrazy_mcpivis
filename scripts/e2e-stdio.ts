// scripts/e2e-stdio.ts
//
// Teste end-to-end do servidor MCP: sobe `dist/index.js` como um cliente MCP faria
// (spawn + stdio), faz o handshake JSON-RPC e um tools/list.
//
// Valida três coisas que os testes unitários não pegam:
//   1. o binario buildado sobe e completa o handshake MCP;
//   2. as 18 tools sao declaradas com schema valido;
//   3. NADA alem de JSON-RPC sai no stdout (banner de dotenv, console.log esquecido, etc).
//
// Nao faz nenhuma chamada de rede: `tools/list` e puramente protocolar.
//
//   npm run test:e2e

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ENTRY = fileURLToPath(new URL("../dist/index.js", import.meta.url));

const EXPECTED_TOOLS = [
  "activities",
  "attendants",
  "business_actions",
  "businesses",
  "conversations",
  "instances",
  "lead_activities",
  "lead_attachments",
  "lead_businesses",
  "lead_history",
  "lead_notes",
  "leads",
  "lists",
  "loss_reasons",
  "n8n_sync",
  "pipelines",
  "products",
  "tags",
];

interface JsonRpcMessage {
  jsonrpc: string;
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

const failures: string[] = [];
function check(ok: boolean, label: string, detail = "") {
  if (ok) {
    console.error(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failures.push(label);
  }
}

async function main() {
  if (!existsSync(ENTRY)) {
    console.error(`✗ ${ENTRY} nao existe. Rode 'npm run build' antes.`);
    process.exit(1);
  }

  console.error("→ subindo dist/index.js via stdio\n");

  const child = spawn(process.execPath, [ENTRY], {
    stdio: ["pipe", "pipe", "pipe"],
    // Token sintético: tools/list nao faz chamada de rede, mas loadConfig exige a var.
    env: { ...process.env, DATACRAZY_API_TOKEN: process.env.DATACRAZY_API_TOKEN || "e2e-placeholder" },
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
  child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

  const send = (payload: unknown) => child.stdin.write(`${JSON.stringify(payload)}\n`);

  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "e2e-stdio", version: "1.0.0" },
    },
  });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });

  const exitCode = await new Promise<number>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve(-1);
    }, 15_000);

    // Encerra assim que a resposta do id 2 chegar.
    const poll = setInterval(() => {
      if (stdout.includes('"id":2')) {
        clearTimeout(timer);
        clearInterval(poll);
        child.stdin.end();
        child.kill("SIGTERM");
        resolve(0);
      }
    }, 50);

    child.on("exit", (code) => {
      clearTimeout(timer);
      clearInterval(poll);
      resolve(code ?? 0);
    });
  });

  if (exitCode === -1) {
    console.error("✗ timeout: o servidor nao respondeu tools/list em 15s");
    if (stderr.trim()) console.error(`  stderr:\n${stderr}`);
    process.exit(1);
  }

  // ── 1. pureza do stdout ────────────────────────────────────────────────────
  const lines = stdout.split("\n").filter((l) => l.trim());
  const nonJson = lines.filter((l) => {
    try {
      JSON.parse(l);
      return false;
    } catch {
      return true;
    }
  });
  check(
    nonJson.length === 0,
    "stdout contem apenas JSON-RPC",
    nonJson.length ? `${nonJson.length} linha(s) intrusa(s): ${JSON.stringify(nonJson[0]?.slice(0, 80))}` : "",
  );

  const messages: JsonRpcMessage[] = lines
    .map((l) => {
      try {
        return JSON.parse(l) as JsonRpcMessage;
      } catch {
        return null;
      }
    })
    .filter((m): m is JsonRpcMessage => m !== null);

  // ── 2. handshake ───────────────────────────────────────────────────────────
  const init = messages.find((m) => m.id === 1);
  check(init !== undefined, "initialize respondeu");
  check(init?.error === undefined, "initialize sem erro", init?.error?.message ?? "");

  const serverInfo = (init?.result as { serverInfo?: { name?: string } } | undefined)?.serverInfo;
  check(serverInfo?.name === "mcp-datacrazy", "serverInfo.name e 'mcp-datacrazy'", `veio ${serverInfo?.name}`);

  // ── 3. tools/list ──────────────────────────────────────────────────────────
  const listMsg = messages.find((m) => m.id === 2);
  check(listMsg !== undefined, "tools/list respondeu");
  check(listMsg?.error === undefined, "tools/list sem erro", listMsg?.error?.message ?? "");

  const tools = (listMsg?.result as { tools?: Array<{ name: string; inputSchema?: unknown }> } | undefined)?.tools ?? [];
  const names = tools.map((t) => t.name).sort();

  check(tools.length === EXPECTED_TOOLS.length, `declara ${EXPECTED_TOOLS.length} tools`, `veio ${tools.length}`);

  const missing = EXPECTED_TOOLS.filter((n) => !names.includes(n));
  const extra = names.filter((n) => !EXPECTED_TOOLS.includes(n));
  check(missing.length === 0, "nenhuma tool faltando", missing.join(", "));
  check(extra.length === 0, "nenhuma tool inesperada", extra.join(", "));

  const semSchema = tools.filter((t) => !t.inputSchema).map((t) => t.name);
  check(semSchema.length === 0, "toda tool expoe inputSchema", semSchema.join(", "));

  console.error("");
  if (stderr.trim()) console.error(`stderr do servidor:\n${stderr}\n`);

  if (failures.length) {
    console.error(`✗ e2e falhou (${failures.length}): ${failures.join(", ")}`);
    process.exit(1);
  }
  console.error("✓ e2e passou — servidor sobe, faz handshake e declara as 18 tools sem sujar o stdout");
}

main().catch((err) => {
  console.error("✗ e2e explodiu:", err);
  process.exit(1);
});
