import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

const schema = {
  action: z
    .enum(["list", "add", "update", "delete"])
    .describe("Operacao: list (notas/comentarios), add (novo), update (editar), delete (remover)"),

  leadId: z.string().describe("ID do lead (obrigatorio em todas as actions)"),

  id: z.string().optional().describe("[update/delete] ID da nota/comentario"),
  note: z.string().optional().describe("[add/update] Texto do comentario/anotacao"),

  confirm: z.boolean().optional().describe("[delete] Confirmar exclusao (necessario em SAFE_MODE)"),
};

export function registerLeadNotesTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool(
    "lead_notes",
    "Gerenciar notas/comentarios/anotacoes/observacoes em um lead do CRM DataCrazy. Actions: list, add, update, delete.",
    schema,
    async (params) => {
      switch (params.action) {
        case "list": {
          const result = await client.get(`/api/v1/leads/${params.leadId}/notes`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "add": {
          if (!params.note) throw new Error("action=add requer 'note'");
          const result = await client.post(`/api/v1/leads/${params.leadId}/notes`, { note: params.note });
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "update": {
          if (!params.id || !params.note) throw new Error("action=update requer 'id' e 'note'");
          const result = await client.put(`/api/v1/leads/${params.leadId}/notes/${params.id}`, {
            note: params.note,
          });
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "delete": {
          if (!params.id) throw new Error("action=delete requer 'id'");
          const check = requireConfirmation(config, params.confirm, "lead_notes.delete");
          if (check.blocked) return { content: [{ type: "text", text: check.message }] };
          const result = await client.delete(`/api/v1/leads/${params.leadId}/notes/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
      }
    }
  );
}
