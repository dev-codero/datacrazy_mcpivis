import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";

export function registerInstancesTools(server: McpServer, client: DataCrazyClient, _config: Config) {
  server.tool("list_instances", "Buscar instancias de conexao (WhatsApp, Telegram, etc)", {}, async () => {
    const result = await client.get("/api/v1/instances");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("get_instance", "Buscar instancia de conexao por ID", {
    id: z.string().describe("ID da instancia"),
  }, async (params) => {
    const result = await client.get(`/api/v1/instances/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
