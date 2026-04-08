import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";

export function registerAttendantsTools(server: McpServer, client: DataCrazyClient, _config: Config) {
  server.tool("list_crm_attendants", "Buscar atendentes do CRM", {}, async () => {
    const result = await client.get("/api/v1/attendants/crm");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("get_crm_attendant", "Buscar atendente do CRM por ID", {
    id: z.string().describe("ID do atendente"),
  }, async (params) => {
    const result = await client.get(`/api/v1/attendants/crm/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("list_multi_attendants", "Buscar atendentes do multiatendimento", {}, async () => {
    const result = await client.get("/api/v1/attendants/multi");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("get_multi_attendant", "Buscar atendente do multiatendimento por ID", {
    id: z.string().describe("ID do atendente"),
  }, async (params) => {
    const result = await client.get(`/api/v1/attendants/multi/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
