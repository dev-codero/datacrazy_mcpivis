// scripts/check-env.ts
//
// Confere que o .env carrega e que o token esta presente — SEM revelar o valor.
//
// A versao anterior imprimia `cfg.apiToken.slice(0, 20)`, contra a regra do
// proprio AGENTS.md ("nunca commitar/logar tokens"). Vinte caracteres de um
// token `dc_` sao material sensivel, e a saida costuma acabar em log ou print.
// Para saber QUAL token esta carregado basta a impressao digital.
//
//   npx tsx scripts/check-env.ts

import { createHash } from "node:crypto";
import { loadConfig } from "../src/config.js";

function digital(token: string): string {
  const tipo = token.startsWith("dc_") ? "dc_" : token.split(".").length === 3 ? "JWT" : "desconhecido";
  const hash = createHash("sha256").update(token).digest("hex").slice(0, 8);
  return `${token.length} chars · ${tipo} · sha256:${hash}`;
}

try {
  const cfg = loadConfig();
  console.log("OK");
  console.log("token:      ", digital(cfg.apiToken));
  console.log("apiUrl:     ", cfg.apiUrl);
  console.log("mcpUrl:     ", cfg.mcpUrl);
  console.log("safeMode:   ", cfg.safeMode);
  console.log("n8nDryRun:  ", cfg.n8nDryRun);
} catch (e: unknown) {
  console.log("ERR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
}
