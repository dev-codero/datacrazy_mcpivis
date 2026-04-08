import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

export function registerConversationsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool("list_conversations", "Buscar conversas com filtros", {
    skip: z.number().optional().describe("Offset para paginacao"),
    take: z.number().optional().describe("Limite de resultados"),
    search: z.string().optional().describe("Termo de busca"),
    opened: z.boolean().optional().describe("Filtrar por abertas (default: true)"),
    departments: z.string().optional().describe("IDs dos departamentos"),
    instances: z.string().optional().describe("IDs das instancias"),
    attendants: z.string().optional().describe("IDs dos atendentes"),
    openWindow: z.enum(["last24h", "all"]).optional().describe("Janela de abertura"),
  }, async (params) => {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      skip: params.skip,
      take: params.take,
      search: params.search,
    };
    if (params.opened !== undefined) queryParams["filter[opened]"] = params.opened;
    if (params.departments) queryParams["filter[departments]"] = params.departments;
    if (params.instances) queryParams["filter[instances]"] = params.instances;
    if (params.attendants) queryParams["filter[attendants]"] = params.attendants;
    if (params.openWindow) queryParams["filter[openWindow]"] = params.openWindow;
    const result = await client.get("/api/v1/conversations", queryParams);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("get_conversation_messages", "Buscar mensagens de uma conversa", {
    id: z.string().describe("ID da conversa"),
  }, async (params) => {
    const result = await client.get(`/api/v1/conversations/${params.id}/messages`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("send_message", "Enviar mensagem em uma conversa", {
    id: z.string().describe("ID da conversa"),
    body: z.string().describe("Texto da mensagem"),
    repliedMessageId: z.string().optional().describe("ID da mensagem sendo respondida"),
    scheduledDate: z.string().optional().describe("Data para agendamento (ISO 8601)"),
    isInternal: z.boolean().optional().describe("Se e uma nota interna (nao visivel ao contato)"),
  }, async (params) => {
    const msgBody: Record<string, unknown> = { body: params.body };
    if (params.repliedMessageId) msgBody.repliedMessageId = params.repliedMessageId;
    if (params.scheduledDate) msgBody.scheduledDate = params.scheduledDate;
    if (params.isInternal !== undefined) msgBody.isInternal = params.isInternal;
    const result = await client.post(`/api/v1/conversations/${params.id}/messages`, msgBody);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("finish_conversation", "Finalizar atendimento de uma conversa", {
    id: z.string().describe("ID da conversa"),
    confirm: z.boolean().optional().describe("Confirmar finalizacao (necessario em SAFE_MODE)"),
  }, async (params) => {
    const check = requireConfirmation(config, params.confirm, "finish_conversation");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client.post(`/api/v1/conversations/${params.id}/finish`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
