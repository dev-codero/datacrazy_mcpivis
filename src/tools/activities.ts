import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

const schema = {
  action: z
    .enum(["list", "get", "create", "update", "delete"])
    .describe("Operacao: list, get, create, update, delete"),

  id: z.string().optional().describe("[get/update/delete] ID da atividade"),
  skip: z.number().optional().describe("[list] Offset"),
  take: z.number().optional().describe("[list] Limite"),
  search: z.string().optional().describe("[list] Termo de busca"),
  attendantId: z.string().optional().describe("[list/create/update] ID do atendente"),
  startDate: z.string().optional().describe("[list/create/update] Data inicio (ISO 8601)"),
  startDateLessThan: z.string().optional().describe("[list] Data fim (ISO 8601)"),
  typeId: z.string().optional().describe("[list] ID do tipo de atividade"),
  isCompleted: z.boolean().optional().describe("[list/update] Concluida/pendente"),

  title: z.string().optional().describe("[create/update] Titulo (obrigatorio em create)"),
  description: z.string().optional().describe("[create/update] Descricao"),
  endDate: z.string().optional().describe("[create/update] Data fim (ISO 8601)"),
  leadId: z.string().optional().describe("[create/update] ID do lead (obrigatorio em create)"),
  businessId: z.string().optional().describe("[create/update] ID do negocio vinculado"),
  activityTypeId: z.string().optional().describe("[create/update] ID do tipo de atividade"),
  required: z.boolean().optional().describe("[create/update] Atividade obrigatoria"),
  linkToStage: z.boolean().optional().describe("[create] Vincular a etapa do negocio"),

  confirm: z.boolean().optional().describe("[delete] Confirmar exclusao (necessario em SAFE_MODE)"),
};

export function registerActivitiesTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool(
    "activities",
    "Gerenciar atividades/tarefas/ligacoes/reunioes/follow-ups do CRM DataCrazy. Actions: list, get, create, update, delete.",
    schema,
    async (params) => {
      switch (params.action) {
        case "list": {
          const queryParams: Record<string, string | number | boolean | undefined> = {
            skip: params.skip,
            take: params.take,
            search: params.search,
          };
          if (params.attendantId) queryParams["filter[attendantId]"] = params.attendantId;
          if (params.startDate) queryParams["filter[startDate]"] = params.startDate;
          if (params.startDateLessThan) queryParams["filter[startDateLessThan]"] = params.startDateLessThan;
          if (params.typeId) queryParams["filter[typeId]"] = params.typeId;
          if (params.isCompleted !== undefined) queryParams["filter[isCompleted]"] = params.isCompleted;
          const result = await client.get("/api/v1/activities", queryParams);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "get": {
          if (!params.id) throw new Error("action=get requer 'id'");
          const result = await client.get(`/api/v1/activities/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "create": {
          if (!params.title || !params.leadId) throw new Error("action=create requer 'title' e 'leadId'");
          const body: Record<string, unknown> = {
            title: params.title,
            lead: { id: params.leadId },
          };
          if (params.description) body.description = params.description;
          if (params.startDate) body.startDate = params.startDate;
          if (params.endDate) body.endDate = params.endDate;
          if (params.businessId) body.business = { id: params.businessId };
          if (params.attendantId) body.attendant = { id: params.attendantId };
          if (params.activityTypeId) body.activityType = { id: params.activityTypeId };
          if (params.required !== undefined) body.required = params.required;
          if (params.linkToStage !== undefined) body.linkToStage = params.linkToStage;
          const result = await client.post("/api/v1/activities", body);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "update": {
          if (!params.id) throw new Error("action=update requer 'id'");
          const body: Record<string, unknown> = {};
          if (params.title) body.title = params.title;
          if (params.description) body.description = params.description;
          if (params.startDate) body.startDate = params.startDate;
          if (params.endDate) body.endDate = params.endDate;
          if (params.required !== undefined) body.required = params.required;
          if (params.isCompleted !== undefined) body.isCompleted = params.isCompleted;
          if (params.leadId) body.lead = { id: params.leadId };
          if (params.businessId) body.business = { id: params.businessId };
          if (params.attendantId) body.attendant = { id: params.attendantId };
          if (params.activityTypeId) body.activityType = { id: params.activityTypeId };
          const result = await client.patch(`/api/v1/activities/${params.id}`, body);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "delete": {
          if (!params.id) throw new Error("action=delete requer 'id'");
          const check = requireConfirmation(config, params.confirm, "activities.delete");
          if (check.blocked) return { content: [{ type: "text", text: check.message }] };
          const result = await client.delete(`/api/v1/activities/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
      }
    }
  );
}
