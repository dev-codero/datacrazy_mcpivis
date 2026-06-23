import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

const schema = {
  action: z
    .enum(["list", "get", "create", "update", "delete"])
    .describe("Operacao: list, get, create, update, delete"),

  id: z.string().optional().describe("[get/update/delete] ID do motivo"),
  name: z.string().optional().describe("[create/update] Nome do motivo (obrigatorio em create)"),
  requiredJustification: z
    .boolean()
    .optional()
    .describe("[create/update] Exigir justificativa ao usar este motivo"),

  confirm: z.boolean().optional().describe("[delete] Confirmar exclusao (necessario em SAFE_MODE)"),
};

export function registerLossReasonsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool(
    "loss_reasons",
    "Gerenciar motivos-de-perda/razoes-de-recusa de negocios do CRM DataCrazy. Actions: list, get, create, update, delete.",
    schema,
    async (params) => {
      switch (params.action) {
        case "list": {
          const result = await client.get("/api/v1/business-loss-reasons");
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "get": {
          if (!params.id) throw new Error("action=get requer 'id'");
          const result = await client.get(`/api/v1/business-loss-reasons/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "create": {
          if (!params.name) throw new Error("action=create requer 'name'");
          const body: Record<string, unknown> = { name: params.name };
          if (params.requiredJustification !== undefined) body.requiredJustification = params.requiredJustification;
          const result = await client.post("/api/v1/business-loss-reasons", body);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "update": {
          if (!params.id) throw new Error("action=update requer 'id'");
          const body: Record<string, unknown> = {};
          if (params.name) body.name = params.name;
          if (params.requiredJustification !== undefined) body.requiredJustification = params.requiredJustification;
          const result = await client.put(`/api/v1/business-loss-reasons/${params.id}`, body);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "delete": {
          if (!params.id) throw new Error("action=delete requer 'id'");
          const check = requireConfirmation(config, params.confirm, "loss_reasons.delete");
          if (check.blocked) return { content: [{ type: "text", text: check.message }] };
          const result = await client.delete(`/api/v1/business-loss-reasons/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
      }
    }
  );
}
