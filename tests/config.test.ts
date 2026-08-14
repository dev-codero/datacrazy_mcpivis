import { describe, it, expect, beforeEach, vi } from "vitest";

// config.ts chama loadDotenv() no import, que leria o .env real do repo e faria
// o teste passar/falhar conforme a maquina. Neutralizamos: aqui o unico input e process.env.
vi.mock("dotenv", () => ({ config: vi.fn() }));

const ENV_KEYS = [
  "DATACRAZY_API_TOKEN",
  "DATACRAZY_API_URL",
  "DATACRAZY_MCP_URL",
  "N8N_WEBHOOK_URL",
  "N8N_DRY_RUN",
  "SAFE_MODE",
] as const;

const ORIGINAL_ENV = { ...process.env };

/** Reimporta config.ts com um process.env controlado. */
async function loadFreshConfig(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) process.env[key] = value;

  vi.resetModules();
  const mod = await import("../src/config.js");
  return mod.loadConfig();
}

describe("loadConfig", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  it("falha quando DATACRAZY_API_TOKEN nao esta definido", async () => {
    await expect(loadFreshConfig({})).rejects.toThrow(/DATACRAZY_API_TOKEN/);
  });

  it("aplica os defaults documentados", async () => {
    const config = await loadFreshConfig({ DATACRAZY_API_TOKEN: "tok" });
    expect(config.apiUrl).toBe("https://api.g1.datacrazy.io");
    expect(config.mcpUrl).toBe("https://mcp.g1.datacrazy.io/api/mcp");
    expect(config.safeMode).toBe(true);
    expect(config.n8nDryRun).toBe(true);
  });

  it("respeita as URLs vindas do ambiente", async () => {
    const config = await loadFreshConfig({
      DATACRAZY_API_TOKEN: "tok",
      DATACRAZY_API_URL: "https://api.custom.local",
      DATACRAZY_MCP_URL: "https://mcp.custom.local/api/mcp",
      N8N_WEBHOOK_URL: "https://n8n.custom.local/hook",
    });
    expect(config.apiUrl).toBe("https://api.custom.local");
    expect(config.mcpUrl).toBe("https://mcp.custom.local/api/mcp");
    expect(config.n8nWebhookUrl).toBe("https://n8n.custom.local/hook");
  });

  it("so desliga safeMode com a string exata 'false'", async () => {
    const off = await loadFreshConfig({ DATACRAZY_API_TOKEN: "tok", SAFE_MODE: "false" });
    expect(off.safeMode).toBe(false);

    // Contrato deliberado: qualquer outro valor mantém o modo seguro ligado.
    // Isso evita que um "0" ou "no" mal digitado desarme a protecao sem querer.
    for (const value of ["0", "no", "FALSE", "", "true"]) {
      const config = await loadFreshConfig({ DATACRAZY_API_TOKEN: "tok", SAFE_MODE: value });
      expect(config.safeMode, `SAFE_MODE=${JSON.stringify(value)} deveria manter safeMode ligado`).toBe(true);
    }
  });

  it("so desliga n8nDryRun com a string exata 'false'", async () => {
    const off = await loadFreshConfig({ DATACRAZY_API_TOKEN: "tok", N8N_DRY_RUN: "false" });
    expect(off.n8nDryRun).toBe(false);

    for (const value of ["0", "no", "FALSE", ""]) {
      const config = await loadFreshConfig({ DATACRAZY_API_TOKEN: "tok", N8N_DRY_RUN: value });
      expect(config.n8nDryRun, `N8N_DRY_RUN=${JSON.stringify(value)} deveria manter dry-run ligado`).toBe(true);
    }
  });
});
