import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

const schema = {
  action: z
    .enum(["list", "messages", "send", "finish"])
    .describe("Operacao: list (conversas), messages (mensagens de uma conversa), send (enviar mensagem), finish (encerrar atendimento)"),

  id: z.string().optional().describe("[messages/send/finish] ID da conversa"),

  skip: z.number().optional().describe("[list] Offset"),
  take: z.number().optional().describe("[list] Limite"),
  search: z.string().optional().describe("[list] Termo de busca"),
  opened: z.boolean().optional().describe("[list] Filtrar por abertas (default: true)"),
  departments: z.string().optional().describe("[list] IDs dos departamentos"),
  instances: z.string().optional().describe("[list] IDs das instancias"),
  attendants: z.string().optional().describe("[list] IDs dos atendentes"),
  openWindow: z.enum(["last24h", "all"]).optional().describe("[list] Janela de abertura"),

  body: z.string().optional().describe("[send] Texto da mensagem"),
  repliedMessageId: z.string().optional().describe("[send] ID da mensagem sendo respondida"),
  scheduledDate: z.string().optional().describe("[send] Data para agendamento (ISO 8601)"),
  isInternal: z.boolean().optional().describe("[send] Nota interna (nao visivel ao contato)"),

  confirm: z.boolean().optional().describe("[finish] Confirmar finalizacao (necessario em SAFE_MODE)"),
};

export function registerConversationsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool(
    "conversations",
    "Gerenciar conversas/atendimentos/chats/mensagens (WhatsApp, Instagram, etc) do CRM DataCrazy. Actions: list, messages, send, finish.",
    schema,
    async (params) => {
      switch (params.action) {
        case "list": {
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
        }
        case "messages": {
          if (!params.id) throw new Error("action=messages requer 'id'");
          const result = await client.get(`/api/v1/conversations/${params.id}/messages`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "send": {
          if (!params.id || !params.body) throw new Error("action=send requer 'id' e 'body'");
          const msgBody: Record<string, unknown> = { body: params.body };
          if (params.repliedMessageId) msgBody.repliedMessageId = params.repliedMessageId;
          if (params.scheduledDate) msgBody.scheduledDate = params.scheduledDate;
          if (params.isInternal !== undefined) msgBody.isInternal = params.isInternal;
          const result = await client.post(`/api/v1/conversations/${params.id}/messages`, msgBody);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "finish": {
          if (!params.id) throw new Error("action=finish requer 'id'");
          const check = requireConfirmation(config, params.confirm, "conversations.finish");
          if (check.blocked) return { content: [{ type: "text", text: check.message }] };
          const result = await client.post(`/api/v1/conversations/${params.id}/finish`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
      }
    }
  );
}
