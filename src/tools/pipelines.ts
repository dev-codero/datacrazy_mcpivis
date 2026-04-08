import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";

export function registerPipelinesTools(server: McpServer, client: DataCrazyClient, _config: Config) {
  server.tool("list_pipelines", "Buscar todos os pipelines de vendas", {}, async () => {
    const result = await client.get("/api/v1/pipelines");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("get_pipeline", "Buscar pipeline por ID com detalhes e permissoes", {
    id: z.string().describe("ID do pipeline"),
  }, async (params) => {
    const result = await client.get(`/api/v1/pipelines/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("get_pipeline_stages", "Buscar etapas de um pipeline", {
    id: z.string().describe("ID do pipeline"),
  }, async (params) => {
    const result = await client.get(`/api/v1/pipelines/${params.id}/stages`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
