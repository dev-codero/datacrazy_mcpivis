import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

export function registerLeadNotesTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool("list_lead_notes", "Buscar comentarios/anotacoes de um lead", {
    leadId: z.string().describe("ID do lead"),
  }, async (params) => {
    const result = await client.get(`/api/v1/leads/${params.leadId}/notes`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("add_lead_note", "Adicionar comentario a um lead", {
    leadId: z.string().describe("ID do lead"),
    note: z.string().describe("Texto do comentario"),
  }, async (params) => {
    const result = await client.post(`/api/v1/leads/${params.leadId}/notes`, { note: params.note });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("update_lead_note", "Atualizar comentario de um lead", {
    leadId: z.string().describe("ID do lead"),
    id: z.string().describe("ID do comentario"),
    note: z.string().describe("Novo texto do comentario"),
  }, async (params) => {
    const result = await client.put(`/api/v1/leads/${params.leadId}/notes/${params.id}`, { note: params.note });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("delete_lead_note", "Excluir comentario de um lead", {
    leadId: z.string().describe("ID do lead"),
    id: z.string().describe("ID do comentario"),
    confirm: z.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)"),
  }, async (params) => {
    const check = requireConfirmation(config, params.confirm, "delete_lead_note");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client.delete(`/api/v1/leads/${params.leadId}/notes/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
