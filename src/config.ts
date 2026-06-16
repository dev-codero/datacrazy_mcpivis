import { config as loadDotenv } from "dotenv";

// Carrega .env se existir. Não sobrescreve vars já definidas no shell.
loadDotenv();

export interface Config {
  apiToken: string;
  apiUrl: string;
  mcpUrl: string;
  n8nWebhookUrl: string;
  n8nDryRun: boolean;
  safeMode: boolean;
}

export function loadConfig(): Config {
  const apiToken = process.env.DATACRAZY_API_TOKEN;
  if (!apiToken) {
    throw new Error("DATACRAZY_API_TOKEN environment variable is required");
  }
  return {
    apiToken,
    // REST API legada (mantida pra compat) — alguns endpoints podem ainda apontar aqui
    apiUrl: process.env.DATACRAZY_API_URL || "https://api.g1.datacrazy.io",
    // MCP JSON-RPC oficial (default atual = o que funciona com o token)
    mcpUrl: process.env.DATACRAZY_MCP_URL || "https://mcp.g1.datacrazy.io/api/mcp",
    // Webhook n8n
    n8nWebhookUrl:
      process.env.N8N_WEBHOOK_URL ||
      "https://n8m.conversoai.com.br/webhook/3394ed04-1c67-4bae-89ec-ee71f46b6d95",
    // Dry-run global — se true, sync para n8n NUNCA envia, só loga
    n8nDryRun: process.env.N8N_DRY_RUN !== "false",
    safeMode: process.env.SAFE_MODE !== "false",
  };
}
