import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

export function registerListsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool("list_lists", "Buscar todas as listas do CRM", {}, async () => {
    const result = await client.get("/api/v1/lists");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("get_list", "Buscar lista por ID", {
    id: z.string().describe("ID da lista"),
  }, async (params) => {
    const result = await client.get(`/api/v1/lists/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("create_list", "Criar uma nova lista", {
    name: z.string().describe("Nome da lista"),
    description: z.string().optional().describe("Descricao da lista"),
  }, async (params) => {
    const result = await client.post("/api/v1/lists", params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("update_list", "Atualizar uma lista existente", {
    id: z.string().describe("ID da lista"),
    name: z.string().optional().describe("Nome"),
    description: z.string().optional().describe("Descricao"),
  }, async (params) => {
    const { id, ...body } = params;
    const result = await client.put(`/api/v1/lists/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("delete_list", "Excluir uma lista (irreversivel)", {
    id: z.string().describe("ID da lista"),
    confirm: z.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)"),
  }, async (params) => {
    const check = requireConfirmation(config, params.confirm, "delete_list");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client.delete(`/api/v1/lists/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
