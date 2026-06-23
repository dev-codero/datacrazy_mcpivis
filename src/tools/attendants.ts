import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";

const schema = {
  action: z.enum(["list", "get"]).describe("Operacao: list (todos do scope) ou get (por id)"),
  scope: z
    .enum(["crm", "multi"])
    .describe("Tipo de atendente: crm (vendedores do CRM) ou multi (atendentes do multiatendimento)"),
  id: z.string().optional().describe("[get] ID do atendente"),
};

export function registerAttendantsTools(server: McpServer, client: DataCrazyClient, _config: Config) {
  server.tool(
    "attendants",
    "Consultar atendentes/vendedores/operadores do CRM DataCrazy. Read-only. Actions: list, get. Scope define se e do CRM ou do multiatendimento.",
    schema,
    async (params) => {
      const base = params.scope === "crm" ? "/api/v1/attendants/crm" : "/api/v1/attendants/multi";
      switch (params.action) {
        case "list": {
          const result = await client.get(base);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "get": {
          if (!params.id) throw new Error("action=get requer 'id'");
          const result = await client.get(`${base}/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
      }
    }
  );
}
