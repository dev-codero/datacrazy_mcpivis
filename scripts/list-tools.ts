// scripts/list-tools.ts
import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";
const cfg = loadConfig();
const mcp = new McpClient(cfg);
const tools = (await mcp.callTool("tools_list", {})) as { tools?: Array<{ name: string; description?: string }> };
console.log("Total tools:", tools.tools?.length ?? 0);
for (const t of tools.tools ?? []) {
  console.log(`${t.name}`);
}
