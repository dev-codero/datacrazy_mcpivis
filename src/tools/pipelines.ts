import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";

const schema = {
  action: z
    .enum(["list", "get", "stages"])
    .describe("Operacao: list (todos os pipelines), get (detalhes), stages (etapas/colunas de um pipeline)"),

  id: z.string().optional().describe("[get/stages] ID do pipeline"),
};

export function registerPipelinesTools(server: McpServer, client: DataCrazyClient, _config: Config) {
  server.tool(
    "pipelines",
    "Consultar pipelines/funis-de-venda e suas etapas/colunas/stages do CRM DataCrazy. Read-only (criacao de pipeline so via UI). Actions: list, get, stages.",
    schema,
    async (params) => {
      switch (params.action) {
        case "list": {
          const result = await client.get("/api/v1/pipelines");
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "get": {
          if (!params.id) throw new Error("action=get requer 'id'");
          const result = await client.get(`/api/v1/pipelines/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "stages": {
          if (!params.id) throw new Error("action=stages requer 'id'");
          const result = await client.get(`/api/v1/pipelines/${params.id}/stages`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
      }
    }
  );
}
