// scripts/raw-tools.ts
import { loadConfig } from "../src/config.js";
const cfg = loadConfig();

async function rpc(method: string, params: unknown = {}) {
  const res = await fetch(cfg.mcpUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await res.text();
  // Se vier SSE, extrai o data:
  if (text.startsWith("data:")) {
    const lines = text.split("\n").filter((l) => l.startsWith("data:"));
    return lines.map((l) => l.slice(6).trim()).join("");
  }
  return text;
}

console.log("=== tools/list ===");
console.log(await rpc("tools/list"));

console.log("\n\n=== initialize ===");
console.log(await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "scout", version: "1" } }));
