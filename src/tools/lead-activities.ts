import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";

export function registerLeadActivitiesTools(server: McpServer, client: DataCrazyClient, _config: Config) {
  server.tool(
    "lead_activities",
    "Listar atividades/tarefas/ligacoes vinculadas a um lead do CRM DataCrazy.",
    {
      id: z.string().describe("ID do lead"),
      skip: z.number().optional().describe("Offset para paginacao"),
      take: z.number().optional().describe("Limite de resultados"),
      search: z.string().optional().describe("Termo de busca"),
    },
    async (params) => {
      const result = await client.get(`/api/v1/leads/${params.id}/activities`, {
        skip: params.skip,
        take: params.take,
        search: params.search,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
