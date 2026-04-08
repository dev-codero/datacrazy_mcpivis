import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

export function registerBusinessesTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool("list_businesses", "Buscar negocios com paginacao e filtros", {
    skip: z.number().optional().describe("Offset para paginacao"),
    take: z.number().optional().describe("Limite de resultados"),
    search: z.string().optional().describe("Termo de busca"),
    status: z.string().optional().describe("Filtro por status: won, in_process, lost"),
    attendants: z.array(z.string()).optional().describe("IDs dos atendentes"),
    minValue: z.number().optional().describe("Valor minimo do negocio"),
    maxValue: z.number().optional().describe("Valor maximo do negocio"),
    startDate: z.string().optional().describe("Data inicio (ISO 8601)"),
    endDate: z.string().optional().describe("Data fim (ISO 8601)"),
  }, async (params) => {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      skip: params.skip,
      take: params.take,
      search: params.search,
    };
    if (params.status) queryParams["filter[status]"] = params.status;
    if (params.minValue) queryParams["filter[minValue]"] = params.minValue;
    if (params.maxValue) queryParams["filter[maxValue]"] = params.maxValue;
    if (params.startDate) queryParams["filter[startDate]"] = params.startDate;
    if (params.endDate) queryParams["filter[endDate]"] = params.endDate;
    if (params.attendants) queryParams["filter[attendants]"] = params.attendants.join(",");
    const result = await client.get("/api/v1/businesses", queryParams);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("get_business", "Buscar negocio por ID com todos os detalhes", {
    id: z.string().describe("ID do negocio"),
  }, async (params) => {
    const result = await client.get(`/api/v1/businesses/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("create_business", "Criar um novo negocio no CRM", {
    leadId: z.string().describe("ID do lead (obrigatorio)"),
    stageId: z.string().describe("ID da etapa do pipeline (obrigatorio)"),
    attendantId: z.string().optional().describe("ID do atendente responsavel"),
    externalId: z.string().optional().describe("ID externo para integracao"),
  }, async (params) => {
    const body: Record<string, unknown> = {
      leadId: params.leadId,
      stageId: params.stageId,
    };
    if (params.attendantId) body.attendantId = params.attendantId;
    if (params.externalId) body.externalId = params.externalId;
    const result = await client.post("/api/v1/businesses", body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("update_business", "Atualizar dados de um negocio existente", {
    id: z.string().describe("ID do negocio"),
    leadId: z.string().optional().describe("ID do lead"),
    stageId: z.string().optional().describe("ID da etapa"),
    attendantId: z.string().optional().describe("ID do atendente"),
    externalId: z.string().optional().describe("ID externo"),
  }, async (params) => {
    const { id, ...body } = params;
    const result = await client.patch(`/api/v1/businesses/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("delete_business", "Excluir um negocio do CRM (irreversivel)", {
    id: z.string().describe("ID do negocio"),
    confirm: z.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)"),
  }, async (params) => {
    const check = requireConfirmation(config, params.confirm, "delete_business");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client.delete(`/api/v1/businesses/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
