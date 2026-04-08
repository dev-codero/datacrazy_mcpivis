import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

export function registerBusinessActionsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool("move_business", "Mover negocios para outra etapa do pipeline", {
    ids: z.array(z.string()).describe("IDs dos negocios"),
    destinationStageId: z.string().describe("ID da etapa de destino"),
  }, async (params) => {
    const result = await client.post("/api/v1/businesses/actions/move", {
      ids: params.ids,
      destinationStageId: params.destinationStageId,
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("win_business", "Marcar negocios como ganhos", {
    ids: z.array(z.string()).describe("IDs dos negocios"),
  }, async (params) => {
    const result = await client.post("/api/v1/businesses/actions/win", { ids: params.ids });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("lose_business", "Marcar negocios como perdidos (irreversivel sem restore)", {
    ids: z.array(z.string()).describe("IDs dos negocios"),
    lossReasonId: z.string().describe("ID do motivo de perda"),
    justification: z.string().optional().describe("Justificativa da perda"),
    confirm: z.boolean().optional().describe("Confirmar acao (necessario em SAFE_MODE)"),
  }, async (params) => {
    const check = requireConfirmation(config, params.confirm, "lose_business");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const body: Record<string, unknown> = {
      ids: params.ids,
      lossReasonId: params.lossReasonId,
    };
    if (params.justification) body.justification = params.justification;
    const result = await client.post("/api/v1/businesses/actions/lose", body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("restore_business", "Restaurar negocios perdidos ou ganhos para em andamento", {
    ids: z.array(z.string()).describe("IDs dos negocios"),
  }, async (params) => {
    const result = await client.post("/api/v1/businesses/actions/restore", { ids: params.ids });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
