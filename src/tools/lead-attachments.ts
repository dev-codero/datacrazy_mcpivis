import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

const schema = {
  action: z
    .enum(["list", "add", "delete"])
    .describe("Operacao: list (anexos do lead), add (subir arquivo), delete (remover)"),

  leadId: z.string().describe("ID do lead (obrigatorio em todas as actions)"),

  id: z.string().optional().describe("[delete] ID do anexo"),
  attachmentUrl: z.string().optional().describe("[add] URL do arquivo"),
  fileName: z.string().optional().describe("[add] Nome do arquivo"),
  fileSize: z.number().optional().describe("[add] Tamanho em bytes"),
  description: z.string().optional().describe("[add] Descricao do arquivo"),

  confirm: z.boolean().optional().describe("[delete] Confirmar exclusao (necessario em SAFE_MODE)"),
};

export function registerLeadAttachmentsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool(
    "lead_attachments",
    "Gerenciar anexos/arquivos/documentos vinculados a um lead do CRM DataCrazy. Actions: list (ver anexos), add (subir novo), delete (remover).",
    schema,
    async (params) => {
      switch (params.action) {
        case "list": {
          const result = await client.get(`/api/v1/leads/${params.leadId}/attachments`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "add": {
          if (!params.attachmentUrl || !params.fileName || params.fileSize === undefined) {
            throw new Error("action=add requer 'attachmentUrl', 'fileName' e 'fileSize'");
          }
          const body = {
            attachmentUrl: params.attachmentUrl,
            fileName: params.fileName,
            fileSize: params.fileSize,
            description: params.description,
          };
          const result = await client.post(`/api/v1/leads/${params.leadId}/attachments`, body);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "delete": {
          if (!params.id) throw new Error("action=delete requer 'id'");
          const check = requireConfirmation(config, params.confirm, "lead_attachments.delete");
          if (check.blocked) return { content: [{ type: "text", text: check.message }] };
          const result = await client.delete(`/api/v1/leads/${params.leadId}/attachments/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
      }
    }
  );
}
