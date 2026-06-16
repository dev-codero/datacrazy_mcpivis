// scripts/probe-pagination.ts
// Vê se business_list_by_stage respeita take+skip ou se tem cap interno.

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";

const cfg = loadConfig();
const mcp = new McpClient(cfg);
const STAGE = "c6a76f5a-acd7-4064-bf7c-f8bcf135f135"; // Atendimento

for (const take of [10, 50, 100, 200]) {
  const r = (await mcp.callTool("business_list_by_stage", { stageId: STAGE, take })) as {
    count?: number;
    data?: Array<{ id: string; createdAt: string }>;
  };
  console.log(`take=${take}  count=${r.count}  data.length=${r.data?.length ?? 0}`);
}

console.log("\n=== paginando skip=50, take=10 ===");
const r = (await mcp.callTool("business_list_by_stage", {
  stageId: STAGE,
  skip: 50,
  take: 10,
})) as { count?: number; data?: Array<{ id: string }> };
console.log(`count=${r.count}  data.length=${r.data?.length ?? 0}`);
console.log("ids:", r.data?.map((b) => b.id).join(", "));
