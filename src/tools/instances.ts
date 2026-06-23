import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";

const schema = {
  action: z.enum(["list", "get"]).describe("Operacao: list (todas) ou get (por id)"),
  id: z.string().optional().describe("[get] ID da instancia"),
};

export function registerInstancesTools(server: McpServer, client: DataCrazyClient, _config: Config) {
  server.tool(
    "instances",
    "Consultar instancias-de-conexao/canais (WhatsApp, Telegram, Instagram, etc) do CRM DataCrazy. Read-only. Actions: list, get.",
    schema,
    async (params) => {
      switch (params.action) {
        case "list": {
          const result = await client.get("/api/v1/instances");
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "get": {
          if (!params.id) throw new Error("action=get requer 'id'");
          const result = await client.get(`/api/v1/instances/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
      }
    }
  );
}
