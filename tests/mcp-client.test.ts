import { describe, it, expect } from "vitest";
import { McpClient } from "../src/mcp-client.js";
import { makeConfig, mockFetch, jsonResponse, sseResponse } from "./helpers.js";

/** initialize + tools/call: responde JSON puro nas duas. */
function okJsonTransport(toolResult: unknown) {
  return mockFetch((call, index) => {
    if (index === 0) return jsonResponse({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } });
    return jsonResponse({
      jsonrpc: "2.0",
      id: 2,
      result: { content: [{ type: "text", text: JSON.stringify(toolResult) }] },
    });
  });
}

describe("McpClient", () => {
  it("manda Authorization Bearer e aceita SSE", async () => {
    const { calls } = okJsonTransport({ ok: true });
    await new McpClient(makeConfig({ apiToken: "tok-1" })).callTool("list_leads");

    expect(calls[0].headers.Authorization).toBe("Bearer tok-1");
    expect(calls[0].headers.Accept).toContain("text/event-stream");
    expect(calls[0].headers["Content-Type"]).toBe("application/json");
  });

  it("faz initialize antes da primeira tool e nao repete depois", async () => {
    const { calls } = okJsonTransport({ ok: true });
    const client = new McpClient(makeConfig());

    await client.callTool("list_leads");
    await client.callTool("list_tags");

    const methods = calls.map((c) => (c.body as { method: string }).method);
    expect(methods).toEqual(["initialize", "tools/call", "tools/call"]);
  });

  it("monta o envelope JSON-RPC de tools/call com name e arguments", async () => {
    const { calls } = okJsonTransport({ ok: true });
    await new McpClient(makeConfig()).callTool("list_leads", { page: 2 });

    expect(calls[1].body).toMatchObject({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "list_leads", arguments: { page: 2 } },
    });
  });

  it("incrementa o id JSON-RPC a cada request", async () => {
    const { calls } = okJsonTransport({ ok: true });
    const client = new McpClient(makeConfig());
    await client.callTool("a");
    await client.callTool("b");

    const ids = calls.map((c) => (c.body as { id: number }).id);
    expect(ids).toEqual([1, 2, 3]);
  });

  it("faz parse de resposta SSE e devolve o payload da ultima linha data:", async () => {
    mockFetch((_call, index) => {
      if (index === 0) {
        return sseResponse([{ jsonrpc: "2.0", id: 1, result: {} }], { "mcp-session-id": "sess-1" });
      }
      return sseResponse([
        { jsonrpc: "2.0", id: 2, result: { content: [{ type: "text", text: '{"total":7}' }] } },
      ]);
    });

    const result = await new McpClient(makeConfig()).callTool<{ total: number }>("count_leads");
    expect(result).toEqual({ total: 7 });
  });

  it("captura o mcp-session-id e reenvia nos requests seguintes", async () => {
    const { calls } = mockFetch((_call, index) => {
      if (index === 0) {
        return jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }, { headers: { "mcp-session-id": "sess-42" } });
      }
      return jsonResponse({ jsonrpc: "2.0", id: 2, result: { content: [] } });
    });

    await new McpClient(makeConfig()).callTool("list_leads");

    expect(calls[0].headers["Mcp-Session-Id"]).toBeUndefined();
    expect(calls[1].headers["Mcp-Session-Id"]).toBe("sess-42");
  });

  it("deserializa o texto quando ele e JSON", async () => {
    okJsonTransport({ leads: [{ id: "abc" }] });
    const result = await new McpClient(makeConfig()).callTool<{ leads: Array<{ id: string }> }>("list_leads");
    expect(result.leads[0].id).toBe("abc");
  });

  it("devolve o texto cru quando ele nao e JSON", async () => {
    mockFetch((_call, index) => {
      if (index === 0) return jsonResponse({ jsonrpc: "2.0", id: 1, result: {} });
      return jsonResponse({
        jsonrpc: "2.0",
        id: 2,
        result: { content: [{ type: "text", text: "lead atualizado com sucesso" }] },
      });
    });

    const result = await new McpClient(makeConfig()).callTool("update_lead");
    expect(result).toBe("lead atualizado com sucesso");
  });

  it("devolve o result inteiro quando nao ha bloco de texto", async () => {
    mockFetch((_call, index) => {
      if (index === 0) return jsonResponse({ jsonrpc: "2.0", id: 1, result: {} });
      return jsonResponse({
        jsonrpc: "2.0",
        id: 2,
        result: { content: [{ type: "image", data: "..." }] },
      });
    });

    const result = await new McpClient(makeConfig()).callTool("screenshot");
    expect(result).toEqual({ content: [{ type: "image", data: "..." }] });
  });

  it("propaga erro JSON-RPC do initialize", async () => {
    mockFetch(() => jsonResponse({ jsonrpc: "2.0", id: 1, error: { code: -32001, message: "token invalido" } }));

    await expect(new McpClient(makeConfig()).callTool("list_leads")).rejects.toThrow(
      /MCP init error: token invalido/,
    );
  });

  it("propaga erro JSON-RPC da tool", async () => {
    mockFetch((_call, index) => {
      if (index === 0) return jsonResponse({ jsonrpc: "2.0", id: 1, result: {} });
      return jsonResponse({ jsonrpc: "2.0", id: 2, error: { code: -32602, message: "lead_id obrigatorio" } });
    });

    await expect(new McpClient(makeConfig()).callTool("get_lead")).rejects.toThrow(
      /MCP tool error: lead_id obrigatorio/,
    );
  });

  it("propaga erro HTTP com status e corpo", async () => {
    mockFetch(() => new Response("rate limited", { status: 429 }));

    await expect(new McpClient(makeConfig()).callTool("list_leads")).rejects.toThrow(
      /MCP HTTP 429: rate limited/,
    );
  });

  it("nao marca a sessao como inicializada quando o initialize falha", async () => {
    let initAttempts = 0;
    mockFetch((call) => {
      const method = (call.body as { method: string }).method;
      if (method === "initialize") {
        initAttempts++;
        return jsonResponse({ jsonrpc: "2.0", id: 1, error: { code: -32001, message: "nope" } });
      }
      return jsonResponse({ jsonrpc: "2.0", id: 2, result: { content: [] } });
    });

    const client = new McpClient(makeConfig());
    await expect(client.callTool("a")).rejects.toThrow();
    await expect(client.callTool("b")).rejects.toThrow();

    // Uma falha de init nao pode deixar o cliente num estado meio-inicializado.
    expect(initAttempts).toBe(2);
  });
});

/**
 * Regressao: o MCP do DataCrazy reporta falha de aplicacao dentro do payload de
 * sucesso, nao como erro JSON-RPC. Antes de 2026-08-13 o cliente devolvia esses
 * envelopes como se a operacao tivesse dado certo — foi assim que uma atribuicao
 * de atendente "funcionou" sem atribuir nada.
 */
describe("erro dentro do payload de sucesso", () => {
  function transporteComResultado(payload: unknown, extra: Record<string, unknown> = {}) {
    return mockFetch((_call, index) => {
      if (index === 0) return jsonResponse({ jsonrpc: "2.0", id: 1, result: {} });
      return jsonResponse({
        jsonrpc: "2.0",
        id: 2,
        result: { content: [{ type: "text", text: JSON.stringify(payload) }], ...extra },
      });
    });
  }

  it("lanca quando o payload e um envelope de erro textual", async () => {
    transporteComResultado({ error: "Attendant was not found for the given userId." });
    await expect(new McpClient(makeConfig()).callTool("lead_update_attendant")).rejects.toThrow(
      /lead_update_attendant.*Attendant was not found/,
    );
  });

  it("lanca no 'Internal server error' devolvido como dado", async () => {
    transporteComResultado({ error: "Internal server error" });
    await expect(new McpClient(makeConfig()).callTool("lead_add_tag")).rejects.toThrow(/Internal server error/);
  });

  it("lanca quando o erro vem como objeto com message", async () => {
    transporteComResultado({ error: { message: "campo obrigatorio ausente" } });
    await expect(new McpClient(makeConfig()).callTool("x")).rejects.toThrow(/campo obrigatorio ausente/);
  });

  it("respeita o isError do protocolo mesmo sem campo error", async () => {
    transporteComResultado({ detalhe: "algo" }, { isError: true });
    await expect(new McpClient(makeConfig()).callTool("y")).rejects.toThrow(/falhou/);
  });

  it("NAO lanca quando 'error' vem junto de dados uteis", async () => {
    // Um registro que por acaso tem um campo chamado error nao e um envelope de erro.
    transporteComResultado({ id: "lead-1", name: "Fulano", error: null });
    await expect(new McpClient(makeConfig()).callTool("lead_get")).resolves.toMatchObject({ id: "lead-1" });
  });

  it("NAO lanca em payload normal", async () => {
    transporteComResultado({ id: "1", name: "ok" });
    await expect(new McpClient(makeConfig()).callTool("lead_get")).resolves.toMatchObject({ id: "1" });
  });

  it("NAO lanca em lista vazia", async () => {
    transporteComResultado({ data: [] });
    await expect(new McpClient(makeConfig()).callTool("lead_list")).resolves.toMatchObject({ data: [] });
  });
});
