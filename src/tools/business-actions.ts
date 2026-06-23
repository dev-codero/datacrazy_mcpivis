import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

const schema = {
  action: z
    .enum(["move", "win", "lose", "restore"])
    .describe("Operacao: move (mover etapa), win (ganhar), lose (perder), restore (restaurar)"),

  ids: z.array(z.string()).describe("IDs dos negocios (obrigatorio em todas as actions)"),

  destinationStageId: z.string().optional().describe("[move] ID da etapa de destino"),
  lossReasonId: z.string().optional().describe("[lose] ID do motivo de perda"),
  justification: z.string().optional().describe("[lose] Justificativa da perda"),

  confirm: z.boolean().optional().describe("[lose] Confirmar acao (necessario em SAFE_MODE)"),
};

export function registerBusinessActionsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool(
    "business_actions",
    "Acoes em negocios/deals do CRM DataCrazy: mover etapa, marcar ganho, marcar perdido, restaurar. Aceita lote (varios IDs).",
    schema,
    async (params) => {
      switch (params.action) {
        case "move": {
          if (!params.destinationStageId) throw new Error("action=move requer 'destinationStageId'");
          const result = await client.post("/api/v1/businesses/actions/move", {
            ids: params.ids,
            destinationStageId: params.destinationStageId,
          });
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "win": {
          const result = await client.post("/api/v1/businesses/actions/win", { ids: params.ids });
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "lose": {
          if (!params.lossReasonId) throw new Error("action=lose requer 'lossReasonId'");
          const check = requireConfirmation(config, params.confirm, "business_actions.lose");
          if (check.blocked) return { content: [{ type: "text", text: check.message }] };
          const body: Record<string, unknown> = {
            ids: params.ids,
            lossReasonId: params.lossReasonId,
          };
          if (params.justification) body.justification = params.justification;
          const result = await client.post("/api/v1/businesses/actions/lose", body);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "restore": {
          const result = await client.post("/api/v1/businesses/actions/restore", { ids: params.ids });
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
      }
    }
  );
}
