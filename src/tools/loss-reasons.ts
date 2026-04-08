import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

export function registerLossReasonsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool("list_loss_reasons", "Buscar motivos de perda de negocios", {}, async () => {
    const result = await client.get("/api/v1/business-loss-reasons");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("get_loss_reason", "Buscar motivo de perda por ID", {
    id: z.string().describe("ID do motivo de perda"),
  }, async (params) => {
    const result = await client.get(`/api/v1/business-loss-reasons/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("create_loss_reason", "Criar um novo motivo de perda", {
    name: z.string().describe("Nome do motivo"),
    requiredJustification: z.boolean().optional().describe("Exigir justificativa ao usar este motivo"),
  }, async (params) => {
    const result = await client.post("/api/v1/business-loss-reasons", params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("update_loss_reason", "Atualizar motivo de perda", {
    id: z.string().describe("ID do motivo"),
    name: z.string().optional().describe("Nome"),
    requiredJustification: z.boolean().optional().describe("Exigir justificativa"),
  }, async (params) => {
    const { id, ...body } = params;
    const result = await client.put(`/api/v1/business-loss-reasons/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("delete_loss_reason", "Excluir motivo de perda (irreversivel)", {
    id: z.string().describe("ID do motivo"),
    confirm: z.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)"),
  }, async (params) => {
    const check = requireConfirmation(config, params.confirm, "delete_loss_reason");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client.delete(`/api/v1/business-loss-reasons/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
