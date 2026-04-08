import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataCrazyClient } from "../client.js";
import { Config } from "../config.js";
import { requireConfirmation } from "../safe-mode.js";

export function registerProductsTools(server: McpServer, client: DataCrazyClient, config: Config) {
  server.tool("list_products", "Buscar todos os produtos do CRM", {}, async () => {
    const result = await client.get("/api/v1/products");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("get_product", "Buscar produto por ID", {
    id: z.string().describe("ID do produto"),
  }, async (params) => {
    const result = await client.get(`/api/v1/products/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("create_product", "Criar um novo produto", {
    name: z.string().describe("Nome do produto"),
    price: z.number().describe("Preco do produto"),
    id_sku: z.string().optional().describe("SKU do produto"),
  }, async (params) => {
    const result = await client.post("/api/v1/products", params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("update_product", "Atualizar um produto existente", {
    id: z.string().describe("ID do produto"),
    name: z.string().optional().describe("Nome"),
    price: z.number().optional().describe("Preco"),
    id_sku: z.string().optional().describe("SKU"),
  }, async (params) => {
    const { id, ...body } = params;
    const result = await client.put(`/api/v1/products/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("delete_product", "Excluir produto (nao pode se estiver vinculado a negocio)", {
    id: z.string().describe("ID do produto"),
    confirm: z.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)"),
  }, async (params) => {
    const check = requireConfirmation(config, params.confirm, "delete_product");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client.delete(`/api/v1/products/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}
