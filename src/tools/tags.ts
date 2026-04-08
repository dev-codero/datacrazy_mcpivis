import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

export function registerTagsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool("list_tags", "Buscar todas as tags do CRM", {}, async () => {
    const result = await client.get("/api/v1/tags");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("get_tag", "Buscar tag por ID", {
    id: z.string().describe("ID da tag"),
  }, async (params) => {
    const result = await client.get(`/api/v1/tags/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("create_tag", "Criar uma nova tag", {
    name: z.string().describe("Nome da tag"),
    color: z.string().optional().describe("Cor em hex (ex: #FF0000)"),
    description: z.string().optional().describe("Descricao da tag"),
    useRandomColor: z.boolean().optional().describe("Usar cor aleatoria"),
  }, async (params) => {
    const result = await client.post("/api/v1/tags", params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("update_tag", "Atualizar uma tag existente", {
    id: z.string().describe("ID da tag"),
    name: z.string().optional().describe("Nome"),
    color: z.string().optional().describe("Cor em hex"),
    description: z.string().optional().describe("Descricao"),
  }, async (params) => {
    const { id, ...body } = params;
    const result = await client.put(`/api/v1/tags/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("delete_tag", "Excluir uma tag (irreversivel)", {
    id: z.string().describe("ID da tag"),
    confirm: z.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)"),
  }, async (params) => {
    const check = requireConfirmation(config, params.confirm, "delete_tag");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client.delete(`/api/v1/tags/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
