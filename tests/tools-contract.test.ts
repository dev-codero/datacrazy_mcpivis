import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";

import { registerLeadsTools } from "../src/tools/leads.js";
import { registerLeadAttachmentsTools } from "../src/tools/lead-attachments.js";
import { registerLeadNotesTools } from "../src/tools/lead-notes.js";
import { registerLeadHistoryTools } from "../src/tools/lead-history.js";
import { registerLeadActivitiesTools } from "../src/tools/lead-activities.js";
import { registerLeadBusinessesTools } from "../src/tools/lead-businesses.js";
import { registerBusinessesTools } from "../src/tools/businesses.js";
import { registerBusinessActionsTools } from "../src/tools/business-actions.js";
import { registerActivitiesTools } from "../src/tools/activities.js";
import { registerConversationsTools } from "../src/tools/conversations.js";
import { registerPipelinesTools } from "../src/tools/pipelines.js";
import { registerTagsTools } from "../src/tools/tags.js";
import { registerListsTools } from "../src/tools/lists.js";
import { registerProductsTools } from "../src/tools/products.js";
import { registerLossReasonsTools } from "../src/tools/loss-reasons.js";
import { registerAttendantsTools } from "../src/tools/attendants.js";
import { registerInstancesTools } from "../src/tools/instances.js";
import { registerN8nSyncTools } from "../src/tools/n8n-sync.js";

import { DataCrazyClient } from "../src/client.js";
import { McpClient } from "../src/mcp-client.js";
import type { Config } from "../src/config.js";
import { makeConfig, mockFetch, jsonResponse, fakeServer, textOf, type RegisteredTool } from "./helpers.js";

/** Registra as 18 tools contra um servidor falso, com a config dada. */
function registerAll(config: Config) {
  const { server, tools, byName } = fakeServer();
  const client = new DataCrazyClient(config);
  const mcp = new McpClient(config);

  registerLeadsTools(server, client, config);
  registerLeadAttachmentsTools(server, client, config);
  registerLeadNotesTools(server, client, config);
  registerLeadHistoryTools(server, client, config);
  registerLeadActivitiesTools(server, client, config);
  registerLeadBusinessesTools(server, client, config);
  registerBusinessesTools(server, client, config);
  registerBusinessActionsTools(server, client, config);
  registerActivitiesTools(server, client, config);
  registerConversationsTools(server, client, config);
  registerPipelinesTools(server, client, config);
  registerTagsTools(server, client, config);
  registerListsTools(server, client, config);
  registerProductsTools(server, client, config);
  registerLossReasonsTools(server, client, config);
  registerAttendantsTools(server, client, config);
  registerInstancesTools(server, client, config);
  registerN8nSyncTools(server, mcp, config);

  return { tools, byName };
}

/**
 * O mapa de tools/actions documentado em docs/agent/context.md.
 * Se este teste quebrar, o código e a doc divergiram — conserte os dois.
 */
const EXPECTED_TOOLS: Record<string, string[] | null> = {
  leads: ["list", "get", "create", "update", "delete"],
  lead_notes: ["list", "add", "update", "delete"],
  lead_attachments: ["list", "add", "delete"],
  lead_history: null,
  lead_activities: null,
  lead_businesses: null,
  businesses: ["list", "get", "create", "update", "delete"],
  business_actions: ["move", "win", "lose", "restore"],
  activities: ["list", "get", "create", "update", "delete"],
  conversations: ["list", "messages", "send", "finish"],
  pipelines: ["list", "get", "stages"],
  tags: ["list", "get", "create", "update", "delete"],
  lists: ["list", "get", "create", "update", "delete"],
  products: ["list", "get", "create", "update", "delete"],
  loss_reasons: ["list", "get", "create", "update", "delete"],
  attendants: ["list", "get"],
  instances: ["list", "get"],
  n8n_sync: ["lead_qualificado", "lead_convertido"],
};

/** Toda operação destrutiva que precisa passar por requireConfirmation. */
const DESTRUCTIVE: Array<{ tool: string; params: Record<string, unknown>; gate: string }> = [
  { tool: "leads", params: { action: "delete", id: "1" }, gate: "leads.delete" },
  { tool: "lead_notes", params: { action: "delete", id: "1" }, gate: "lead_notes.delete" },
  { tool: "lead_attachments", params: { action: "delete", id: "1" }, gate: "lead_attachments.delete" },
  { tool: "businesses", params: { action: "delete", id: "1" }, gate: "businesses.delete" },
  {
    tool: "business_actions",
    params: { action: "lose", id: "1", businessId: "1", lossReasonId: "9" },
    gate: "business_actions.lose",
  },
  { tool: "activities", params: { action: "delete", id: "1" }, gate: "activities.delete" },
  { tool: "conversations", params: { action: "finish", id: "1" }, gate: "conversations.finish" },
  { tool: "tags", params: { action: "delete", id: "1" }, gate: "tags.delete" },
  { tool: "lists", params: { action: "delete", id: "1" }, gate: "lists.delete" },
  { tool: "products", params: { action: "delete", id: "1" }, gate: "products.delete" },
  { tool: "loss_reasons", params: { action: "delete", id: "1" }, gate: "loss_reasons.delete" },
  { tool: "n8n_sync", params: { action: "lead_qualificado", leadId: "1" }, gate: "n8n_sync.lead_qualificado" },
];

describe("registro das tools", () => {
  it("registra exatamente as 18 tools documentadas", () => {
    const { tools } = registerAll(makeConfig());
    expect(tools.map((t) => t.name).sort()).toEqual(Object.keys(EXPECTED_TOOLS).sort());
  });

  it("fica abaixo do threshold de ~30 que liga tool_search no Claude Desktop", () => {
    const { tools } = registerAll(makeConfig());
    expect(tools.length).toBeLessThan(30);
  });

  it("nao registra o mesmo nome duas vezes", () => {
    const { tools } = registerAll(makeConfig());
    expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length);
  });

  it("usa snake_case em todos os nomes", () => {
    const { tools } = registerAll(makeConfig());
    for (const tool of tools) {
      expect(tool.name, `${tool.name} nao esta em snake_case`).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("da a cada tool uma descricao util para a busca semantica", () => {
    const { tools } = registerAll(makeConfig());
    for (const tool of tools) {
      expect(tool.description.length, `${tool.name} tem descricao curta demais`).toBeGreaterThan(30);
    }
  });
});

describe("schema das tools", () => {
  const { tools } = registerAll(makeConfig());

  it.each(tools.map((t) => [t.name, t] as const))("%s expoe um discriminador action", (name, tool) => {
    if (EXPECTED_TOOLS[name] === null) return; // operação única, sem discriminador
    expect(tool.schema.action, `${name} deveria ter 'action' no schema`).toBeDefined();
  });

  it.each(
    Object.entries(EXPECTED_TOOLS).filter(([, actions]) => actions !== null) as Array<[string, string[]]>,
  )("%s aceita exatamente as actions documentadas", (name, expected) => {
    const tool = tools.find((t) => t.name === name)!;
    const action = tool.schema.action as z.ZodEnum<[string, ...string[]]>;
    expect([...action.options].sort()).toEqual([...expected].sort());
  });

  it.each(tools.map((t) => [t.name, t] as const))(
    "%s deixa opcional todo param escopado a uma action",
    (name, tool) => {
      // O invariante do bundling: um param que só serve a algumas actions (marcado
      // com o prefixo "[action]" no describe) não pode ser required — senão vira
      // obrigatório para TODAS as actions e quebra as outras.
      // Params usados por todas as actions (ex: lead_notes.leadId) podem ser required.
      for (const [key, value] of Object.entries(tool.schema)) {
        if (key === "action") continue;
        const schema = value as z.ZodTypeAny;
        const isActionScoped = schema.description?.trimStart().startsWith("[") ?? false;
        if (!isActionScoped) continue;
        expect(
          schema.isOptional(),
          `${name}.${key} e escopado a uma action (${schema.description}) mas esta required`,
        ).toBe(true);
      }
    },
  );

  it.each(tools.map((t) => [t.name, t] as const))(
    "%s: params required se declaram obrigatorios na descricao",
    (name, tool) => {
      // Espelho do teste acima: se um param é required num tool bundlado, a descrição
      // precisa dizer isso, senão o LLM não sabe que tem que mandar sempre.
      if (EXPECTED_TOOLS[name] === null) return; // operação única: sem ambiguidade
      for (const [key, value] of Object.entries(tool.schema)) {
        if (key === "action") continue;
        const schema = value as z.ZodTypeAny;
        if (schema.isOptional()) continue;
        expect(
          schema.description ?? "",
          `${name}.${key} e required mas a descricao nao avisa`,
        ).toMatch(/obrigatorio/i);
      }
    },
  );

  it.each(tools.map((t) => [t.name, t] as const))("%s documenta cada param com describe()", (name, tool) => {
    for (const [key, value] of Object.entries(tool.schema)) {
      const description = (value as z.ZodTypeAny).description;
      expect(description, `${name}.${key} esta sem describe()`).toBeTruthy();
    }
  });
});

describe("safe mode nas operacoes destrutivas", () => {
  beforeEach(() => {
    // Se o gate falhar, a chamada vaza para o "servidor" — este mock garante
    // que a gente detecta o vazamento em vez de mascarar com um erro de rede.
    mockFetch(() => jsonResponse({ deleted: true }));
  });

  it.each(DESTRUCTIVE.map((d) => [d.tool, d] as const))(
    "%s: bloqueia sem confirm quando SAFE_MODE esta ligado",
    async (_name, entry) => {
      const { byName } = registerAll(makeConfig({ safeMode: true }));
      const result = await byName(entry.tool).handler(entry.params);

      expect(textOf(result)).toContain("SAFE_MODE");
      expect(textOf(result)).toContain(entry.gate);
    },
  );

  it.each(DESTRUCTIVE.map((d) => [d.tool, d] as const))(
    "%s: nao chega a chamar a API quando bloqueado",
    async (_name, entry) => {
      const { calls } = mockFetch(() => jsonResponse({ deleted: true }));
      const { byName } = registerAll(makeConfig({ safeMode: true }));

      await byName(entry.tool).handler(entry.params);

      expect(calls, `${entry.tool} vazou uma chamada de rede apesar do SAFE_MODE`).toHaveLength(0);
    },
  );

  it("libera a chamada quando confirm: true", async () => {
    const { calls } = mockFetch(() => jsonResponse({ deleted: true }));
    const { byName } = registerAll(makeConfig({ safeMode: true }));

    const result = await byName("tags").handler({ action: "delete", id: "42", confirm: true });

    expect(textOf(result)).not.toContain("SAFE_MODE");
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toContain("/api/v1/tags/42");
  });

  it("libera a chamada quando SAFE_MODE esta desligado", async () => {
    const { calls } = mockFetch(() => jsonResponse({ deleted: true }));
    const { byName } = registerAll(makeConfig({ safeMode: false }));

    await byName("tags").handler({ action: "delete", id: "42" });

    expect(calls).toHaveLength(1);
  });
});

describe("validacao de params obrigatorios em runtime", () => {
  beforeEach(() => {
    mockFetch(() => jsonResponse({}));
  });

  it("tags: action=get sem id da erro nomeando o campo", async () => {
    const { byName } = registerAll(makeConfig());
    await expect(byName("tags").handler({ action: "get" })).rejects.toThrow(/action=get requer 'id'/);
  });

  it("tags: action=create sem name da erro nomeando o campo", async () => {
    const { byName } = registerAll(makeConfig());
    await expect(byName("tags").handler({ action: "create" })).rejects.toThrow(/action=create requer 'name'/);
  });

  it("tags: action=list nao exige nada", async () => {
    const { calls } = mockFetch(() => jsonResponse({ data: [] }));
    const { byName } = registerAll(makeConfig());

    await byName("tags").handler({ action: "list" });

    expect(calls[0].url).toContain("/api/v1/tags");
  });
});

describe("n8n_sync e o dry-run", () => {
  /** initialize + lead_get, via o McpClient real com fetch mockado. */
  function mockMcpTransport() {
    return mockFetch((call, index) => {
      if (index === 0) return jsonResponse({ jsonrpc: "2.0", id: 1, result: {} });
      const method = (call.body as { params?: { name?: string } })?.params?.name;
      if (method === "lead_get") {
        return jsonResponse({
          jsonrpc: "2.0",
          id: 2,
          result: {
            content: [{ type: "text", text: JSON.stringify({ id: "lead-1", name: "Fulano" }) }],
          },
        });
      }
      return jsonResponse({ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: "{}" }] } });
    });
  }

  it("com dryRun default nao envia nada para o webhook", async () => {
    const { calls } = mockMcpTransport();
    const { byName } = registerAll(makeConfig({ safeMode: false, n8nDryRun: true }));

    const result = await byName("n8n_sync").handler({ action: "lead_qualificado", leadId: "lead-1" });

    expect(textOf(result)).toContain("DRY-RUN");
    expect(calls.some((c) => c.url.includes("n8n.test.local"))).toBe(false);
  });

  it("params.dryRun sobrepoe o default da config", async () => {
    mockMcpTransport();
    // Config diz dryRun=false, mas a chamada pede dryRun=true — a chamada vence.
    const { byName } = registerAll(makeConfig({ safeMode: false, n8nDryRun: false }));

    const result = await byName("n8n_sync").handler({
      action: "lead_qualificado",
      leadId: "lead-1",
      dryRun: true,
    });

    expect(textOf(result)).toContain("DRY-RUN");
  });

  it("mapeia lead_qualificado para a planilha e etapa certas", async () => {
    mockMcpTransport();
    const { byName } = registerAll(makeConfig({ safeMode: false, n8nDryRun: true }));

    const result = await byName("n8n_sync").handler({ action: "lead_qualificado", leadId: "lead-1" });

    expect(textOf(result)).toContain("NOVA_LUZ_LEAD_QUALIFICADO");
  });

  it("mapeia lead_convertido para a planilha e etapa certas", async () => {
    mockMcpTransport();
    const { byName } = registerAll(makeConfig({ safeMode: false, n8nDryRun: true }));

    const result = await byName("n8n_sync").handler({ action: "lead_convertido", leadId: "lead-1" });

    expect(textOf(result)).toContain("NOVA_LUZ_LEAD_CONVERTIDO");
  });
});
