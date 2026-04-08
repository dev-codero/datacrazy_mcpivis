import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

export function registerLeadAttachmentsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool("list_lead_attachments", "Buscar arquivos anexados a um lead", {
    leadId: z.string().describe("ID do lead"),
  }, async (params) => {
    const result = await client.get(`/api/v1/leads/${params.leadId}/attachments`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("add_lead_attachment", "Adicionar arquivo anexo a um lead", {
    leadId: z.string().describe("ID do lead"),
    attachmentUrl: z.string().describe("URL do arquivo"),
    fileName: z.string().describe("Nome do arquivo"),
    fileSize: z.number().describe("Tamanho em bytes"),
    description: z.string().optional().describe("Descricao do arquivo"),
  }, async (params) => {
    const body = {
      attachmentUrl: params.attachmentUrl,
      fileName: params.fileName,
      fileSize: params.fileSize,
      description: params.description,
    };
    const result = await client.post(`/api/v1/leads/${params.leadId}/attachments`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("delete_lead_attachment", "Remover arquivo anexado de um lead", {
    leadId: z.string().describe("ID do lead"),
    id: z.string().describe("ID do anexo"),
    confirm: z.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)"),
  }, async (params) => {
    const check = requireConfirmation(config, params.confirm, "delete_lead_attachment");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client.delete(`/api/v1/leads/${params.leadId}/attachments/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
