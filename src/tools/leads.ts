import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

export function registerLeadsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool("list_leads", "Buscar leads com paginacao e filtros", {
    skip: z.number().optional().describe("Offset para paginacao"),
    take: z.number().optional().describe("Limite de resultados"),
    search: z.string().optional().describe("Termo de busca"),
    complete: z.boolean().optional().describe("Incluir campos adicionais"),
  }, async (params) => {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      skip: params.skip,
      take: params.take,
      search: params.search,
    };
    if (params.complete) queryParams["complete[additionalFields]"] = true;
    const result = await client.get("/api/v1/leads", queryParams);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("get_lead", "Buscar lead por ID com todos os detalhes", {
    id: z.string().describe("ID do lead"),
    complete: z.boolean().optional().describe("Incluir campos adicionais"),
  }, async (params) => {
    const queryParams: Record<string, string | number | boolean | undefined> = {};
    if (params.complete) queryParams["complete[additionalFields]"] = true;
    const result = await client.get(`/api/v1/leads/${params.id}`, queryParams);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("create_lead", "Criar um novo lead no CRM", {
    name: z.string().optional().describe("Nome do lead"),
    phone: z.string().optional().describe("Telefone"),
    email: z.string().optional().describe("Email"),
    company: z.string().optional().describe("Empresa"),
    taxId: z.string().optional().describe("CPF/CNPJ"),
    source: z.string().optional().describe("Origem do lead"),
    site: z.string().optional().describe("Site"),
    instagram: z.string().optional().describe("Instagram"),
    image: z.string().optional().describe("URL da imagem"),
    tags: z.array(z.string()).optional().describe("IDs das tags"),
    lists: z.array(z.string()).optional().describe("IDs das listas"),
    attendantId: z.string().optional().describe("ID do atendente responsavel"),
  }, async (params) => {
    const body: Record<string, unknown> = {};
    if (params.name) body.name = params.name;
    if (params.phone) body.phone = params.phone;
    if (params.email) body.email = params.email;
    if (params.company) body.company = params.company;
    if (params.taxId) body.taxId = params.taxId;
    if (params.source) body.source = params.source;
    if (params.site) body.site = params.site;
    if (params.instagram) body.instagram = params.instagram;
    if (params.image) body.image = params.image;
    if (params.tags) body.tags = params.tags.map(id => ({ id }));
    if (params.lists) body.lists = params.lists.map(id => ({ id }));
    if (params.attendantId) body.attendant = { id: params.attendantId };
    const result = await client.post("/api/v1/leads", body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("update_lead", "Atualizar dados de um lead existente", {
    id: z.string().describe("ID do lead"),
    name: z.string().optional().describe("Nome"),
    phone: z.string().optional().describe("Telefone"),
    email: z.string().optional().describe("Email"),
    company: z.string().optional().describe("Empresa"),
    taxId: z.string().optional().describe("CPF/CNPJ"),
    source: z.string().optional().describe("Origem"),
    site: z.string().optional().describe("Site"),
    instagram: z.string().optional().describe("Instagram"),
    tags: z.array(z.string()).optional().describe("IDs das tags"),
    lists: z.array(z.string()).optional().describe("IDs das listas"),
    attendantId: z.string().optional().describe("ID do atendente"),
  }, async (params) => {
    const { id, ...rest } = params;
    const body: Record<string, unknown> = {};
    if (rest.name) body.name = rest.name;
    if (rest.phone) body.phone = rest.phone;
    if (rest.email) body.email = rest.email;
    if (rest.company) body.company = rest.company;
    if (rest.taxId) body.taxId = rest.taxId;
    if (rest.source) body.source = rest.source;
    if (rest.site) body.site = rest.site;
    if (rest.instagram) body.instagram = rest.instagram;
    if (rest.tags) body.tags = rest.tags.map(tid => ({ id: tid }));
    if (rest.lists) body.lists = rest.lists.map(lid => ({ id: lid }));
    if (rest.attendantId) body.attendant = { id: rest.attendantId };
    const result = await client.patch(`/api/v1/leads/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("delete_lead", "Excluir um lead do CRM (irreversivel)", {
    id: z.string().describe("ID do lead"),
    confirm: z.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)"),
  }, async (params) => {
    const check = requireConfirmation(config, params.confirm, "delete_lead");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client.delete(`/api/v1/leads/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
