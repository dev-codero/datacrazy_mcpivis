import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

const schema = {
  action: z
    .enum(["list", "get", "create", "update", "delete"])
    .describe("Operacao: list, get, create, update, delete"),

  id: z.string().optional().describe("[get/update/delete] ID da lista"),
  name: z.string().optional().describe("[create/update] Nome da lista (obrigatorio em create)"),
  description: z.string().optional().describe("[create/update] Descricao da lista"),

  confirm: z.boolean().optional().describe("[delete] Confirmar exclusao (necessario em SAFE_MODE)"),
};

export function registerListsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool(
    "lists",
    "Gerenciar listas/segmentos/grupos do CRM DataCrazy (agrupamento manual de leads). Actions: list, get, create, update, delete.",
    schema,
    async (params) => {
      switch (params.action) {
        case "list": {
          const result = await client.get("/api/v1/lists");
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "get": {
          if (!params.id) throw new Error("action=get requer 'id'");
          const result = await client.get(`/api/v1/lists/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "create": {
          if (!params.name) throw new Error("action=create requer 'name'");
          const body: Record<string, unknown> = { name: params.name };
          if (params.description) body.description = params.description;
          const result = await client.post("/api/v1/lists", body);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "update": {
          if (!params.id) throw new Error("action=update requer 'id'");
          const body: Record<string, unknown> = {};
          if (params.name) body.name = params.name;
          if (params.description) body.description = params.description;
          const result = await client.put(`/api/v1/lists/${params.id}`, body);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "delete": {
          if (!params.id) throw new Error("action=delete requer 'id'");
          const check = requireConfirmation(config, params.confirm, "lists.delete");
          if (check.blocked) return { content: [{ type: "text", text: check.message }] };
          const result = await client.delete(`/api/v1/lists/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
      }
    }
  );
}
