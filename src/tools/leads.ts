import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

const leadsSchema = {
  action: z
    .enum(["list", "get", "create", "update", "delete"])
    .describe("Operacao: list (buscar leads), get (detalhes por id), create (criar), update (atualizar), delete (excluir)"),

  id: z.string().optional().describe("ID do lead. Obrigatorio em get/update/delete"),
  skip: z.number().optional().describe("[list] Offset para paginacao"),
  take: z.number().optional().describe("[list] Limite de resultados"),
  search: z.string().optional().describe("[list] Termo de busca por nome, telefone, email, etc"),
  complete: z.boolean().optional().describe("[list/get] Incluir campos adicionais (additionalFields)"),

  name: z.string().optional().describe("[create/update] Nome do lead/contato/cliente"),
  phone: z.string().optional().describe("[create/update] Telefone"),
  email: z.string().optional().describe("[create/update] Email"),
  company: z.string().optional().describe("[create/update] Empresa"),
  taxId: z.string().optional().describe("[create/update] CPF/CNPJ"),
  source: z.string().optional().describe("[create/update] Origem do lead"),
  site: z.string().optional().describe("[create/update] Site"),
  instagram: z.string().optional().describe("[create/update] Instagram"),
  image: z.string().optional().describe("[create] URL da imagem"),
  tags: z.array(z.string()).optional().describe("[create/update] IDs das tags"),
  lists: z.array(z.string()).optional().describe("[create/update] IDs das listas"),
  attendantId: z.string().optional().describe("[create/update] ID do atendente responsavel"),

  confirm: z.boolean().optional().describe("[delete] Confirmar exclusao (necessario em SAFE_MODE)"),
};

export function registerLeadsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool(
    "leads",
    "Gerenciar leads/contatos/clientes/prospects do CRM DataCrazy. Use action para escolher: list (buscar com paginacao/filtros), get (detalhes por ID), create (novo lead), update (atualizar), delete (excluir, irreversivel).",
    leadsSchema,
    async (params) => {
      switch (params.action) {
        case "list": {
          const queryParams: Record<string, string | number | boolean | undefined> = {
            skip: params.skip,
            take: params.take,
            search: params.search,
          };
          if (params.complete) queryParams["complete[additionalFields]"] = true;
          const result = await client.get("/api/v1/leads", queryParams);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "get": {
          if (!params.id) throw new Error("action=get requer 'id'");
          const queryParams: Record<string, string | number | boolean | undefined> = {};
          if (params.complete) queryParams["complete[additionalFields]"] = true;
          const result = await client.get(`/api/v1/leads/${params.id}`, queryParams);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "create": {
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
          if (params.tags) body.tags = params.tags.map((id) => ({ id }));
          if (params.lists) body.lists = params.lists.map((id) => ({ id }));
          if (params.attendantId) body.attendant = { id: params.attendantId };
          const result = await client.post("/api/v1/leads", body);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "update": {
          if (!params.id) throw new Error("action=update requer 'id'");
          const body: Record<string, unknown> = {};
          if (params.name) body.name = params.name;
          if (params.phone) body.phone = params.phone;
          if (params.email) body.email = params.email;
          if (params.company) body.company = params.company;
          if (params.taxId) body.taxId = params.taxId;
          if (params.source) body.source = params.source;
          if (params.site) body.site = params.site;
          if (params.instagram) body.instagram = params.instagram;
          if (params.tags) body.tags = params.tags.map((tid) => ({ id: tid }));
          if (params.lists) body.lists = params.lists.map((lid) => ({ id: lid }));
          if (params.attendantId) body.attendant = { id: params.attendantId };
          const result = await client.patch(`/api/v1/leads/${params.id}`, body);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "delete": {
          if (!params.id) throw new Error("action=delete requer 'id'");
          const check = requireConfirmation(config, params.confirm, "leads.delete");
          if (check.blocked) return { content: [{ type: "text", text: check.message }] };
          const result = await client.delete(`/api/v1/leads/${params.id}`);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
      }
    }
  );
}
