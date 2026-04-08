import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

export function registerActivitiesTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool("list_activities", "Buscar atividades com paginacao e filtros", {
    skip: z.number().optional().describe("Offset para paginacao"),
    take: z.number().optional().describe("Limite de resultados"),
    search: z.string().optional().describe("Termo de busca"),
    attendantId: z.string().optional().describe("Filtrar por atendente"),
    startDate: z.string().optional().describe("Data inicio (ISO 8601)"),
    startDateLessThan: z.string().optional().describe("Data fim (ISO 8601)"),
    typeId: z.string().optional().describe("ID do tipo de atividade"),
    isCompleted: z.boolean().optional().describe("Filtrar por concluidas/pendentes"),
  }, async (params) => {
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
  });

  server.tool("get_activity", "Buscar atividade por ID", {
    id: z.string().describe("ID da atividade"),
  }, async (params) => {
    const result = await client.get(`/api/v1/activities/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("create_activity", "Criar uma nova atividade", {
    title: z.string().describe("Titulo da atividade (obrigatorio)"),
    description: z.string().optional().describe("Descricao"),
    startDate: z.string().optional().describe("Data inicio (ISO 8601)"),
    endDate: z.string().optional().describe("Data fim (ISO 8601)"),
    leadId: z.string().describe("ID do lead vinculado (obrigatorio)"),
    businessId: z.string().optional().describe("ID do negocio vinculado"),
    attendantId: z.string().optional().describe("ID do atendente responsavel"),
    activityTypeId: z.string().optional().describe("ID do tipo de atividade"),
    required: z.boolean().optional().describe("Se a atividade e obrigatoria"),
    linkToStage: z.boolean().optional().describe("Vincular a etapa do negocio"),
  }, async (params) => {
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
  });

  server.tool("update_activity", "Atualizar uma atividade existente", {
    id: z.string().describe("ID da atividade"),
    title: z.string().optional().describe("Titulo"),
    description: z.string().optional().describe("Descricao"),
    startDate: z.string().optional().describe("Data inicio (ISO 8601)"),
    endDate: z.string().optional().describe("Data fim (ISO 8601)"),
    leadId: z.string().optional().describe("ID do lead"),
    businessId: z.string().optional().describe("ID do negocio"),
    attendantId: z.string().optional().describe("ID do atendente"),
    activityTypeId: z.string().optional().describe("ID do tipo de atividade"),
    required: z.boolean().optional().describe("Se e obrigatoria"),
    isCompleted: z.boolean().optional().describe("Marcar como concluida"),
  }, async (params) => {
    const { id, leadId, businessId, attendantId, activityTypeId, ...rest } = params;
    const body: Record<string, unknown> = { ...rest };
    if (leadId) body.lead = { id: leadId };
    if (businessId) body.business = { id: businessId };
    if (attendantId) body.attendant = { id: attendantId };
    if (activityTypeId) body.activityType = { id: activityTypeId };
    const result = await client.patch(`/api/v1/activities/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("delete_activity", "Excluir uma atividade (irreversivel)", {
    id: z.string().describe("ID da atividade"),
    confirm: z.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)"),
  }, async (params) => {
    const check = requireConfirmation(config, params.confirm, "delete_activity");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client.delete(`/api/v1/activities/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
