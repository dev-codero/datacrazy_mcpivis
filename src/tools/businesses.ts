import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

const schema = {
  action: z
    .enum(["list", "get", "create", "update", "delete"])
    .describe("Operacao: list (buscar negocios), get (detalhes), create, update, delete"),

  id: z.string().optional().describe("[get/update/delete] ID do negocio"),
  skip: z.number().optional().describe("[list] Offset para paginacao"),
  take: z.number().optional().describe("[list] Limite de resultados"),
  search: z.string().optional().describe("[list] Termo de busca"),
  status: z.string().optional().describe("[list] Filtro por status: won, in_process, lost"),
  attendants: z.array(z.string()).optional().describe("[list] IDs dos atendentes"),
  minValue: z.number().optional().describe("[list] Valor minimo do negocio"),
  maxValue: z.number().optional().describe("[list] Valor maximo do negocio"),
  startDate: z.string().optional().describe("[list] Data inicio (ISO 8601)"),
  endDate: z.string().optional().describe("[list] Data fim (ISO 8601)"),

  leadId: z.string().optional().describe("[create/update] ID do lead (obrigatorio em create)"),
  stageId: z.string().optional().describe("[create/update] ID da etapa do pipeline (obrigatorio em create)"),
  attendantId: z.string().optional().describe("[create/update] ID do atendente responsavel"),
  externalId: z.string().optional().describe("[create/update] ID externo para integracao"),

  confirm: z.boolean().optional().describe("[delete] Confirmar exclusao (necessario em SAFE_MODE)"),
};

export function registerBusinessesTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool(
    "businesses",
    "Gerenciar negocios/deals/oportunidades/vendas do CRM DataCrazy. Actions: list, get, create, update, delete. Para mover/ganhar/perder use a tool 'business_actions'.",
    schema,
    async (params) => {
      switch (params.action) {
        case "list": {
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
        }
        case "get": {
          if (!params.id) throw new Error("action=get requer 'id'");
          const result = await client.get(`/api/v1/businesses/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "create": {
          if (!params.leadId || !params.stageId) throw new Error("action=create requer 'leadId' e 'stageId'");
          const body: Record<string, unknown> = {
            leadId: params.leadId,
            stageId: params.stageId,
          };
          if (params.attendantId) body.attendantId = params.attendantId;
          if (params.externalId) body.externalId = params.externalId;
          const result = await client.post("/api/v1/businesses", body);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "update": {
          if (!params.id) throw new Error("action=update requer 'id'");
          const body: Record<string, unknown> = {};
          if (params.leadId) body.leadId = params.leadId;
          if (params.stageId) body.stageId = params.stageId;
          if (params.attendantId) body.attendantId = params.attendantId;
          if (params.externalId) body.externalId = params.externalId;
          const result = await client.patch(`/api/v1/businesses/${params.id}`, body);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "delete": {
          if (!params.id) throw new Error("action=delete requer 'id'");
          const check = requireConfirmation(config, params.confirm, "businesses.delete");
          if (check.blocked) return { content: [{ type: "text", text: check.message }] };
          const result = await client.delete(`/api/v1/businesses/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
      }
    }
  );
}
