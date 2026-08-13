import { vi } from "vitest";
import type { Config } from "../src/config.js";

/** Config previsível para os testes — nada aqui toca a rede. */
export function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    apiToken: "test-token",
    apiUrl: "https://api.test.local",
    mcpUrl: "https://mcp.test.local/api/mcp",
    n8nWebhookUrl: "https://n8n.test.local/webhook/test",
    n8nDryRun: true,
    safeMode: true,
    ...overrides,
  };
}

export interface CapturedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Substitui globalThis.fetch e devolve as chamadas capturadas.
 * `respond` decide a resposta por chamada (default: 200 com {}).
 */
export function mockFetch(
  respond: (call: CapturedCall, index: number) => Response | Promise<Response> = () => jsonResponse({}),
) {
  const calls: CapturedCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawBody = init?.body;
    const call: CapturedCall = {
      url: typeof input === "string" ? input : input.toString(),
      method: init?.method ?? "GET",
      headers: (init?.headers as Record<string, string>) ?? {},
      body: typeof rawBody === "string" ? safeJsonParse(rawBody) : rawBody,
    };
    calls.push(call);
    return respond(call, calls.length - 1);
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

/** Resposta SSE como o MCP oficial devolve: linhas `data: <json>`. */
export function sseResponse(payloads: unknown[], extraHeaders: Record<string, string> = {}): Response {
  const text = payloads.map((p) => `event: message\ndata: ${JSON.stringify(p)}\n\n`).join("");
  return new Response(text, {
    status: 200,
    headers: { "content-type": "text/event-stream", ...extraHeaders },
  });
}

/**
 * Servidor MCP falso: captura as tools registradas em vez de falar JSON-RPC.
 * Espelha só a assinatura que as tools usam — server.tool(name, description, schema, handler).
 */
export interface RegisteredTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

export function fakeServer() {
  const tools: RegisteredTool[] = [];
  const server = {
    tool(name: string, description: string, schema: Record<string, unknown>, handler: RegisteredTool["handler"]) {
      tools.push({ name, description, schema, handler });
    },
  };
  return {
    server: server as never,
    tools,
    byName: (name: string) => {
      const found = tools.find((t) => t.name === name);
      if (!found) throw new Error(`tool nao registrada: ${name}`);
      return found;
    },
  };
}

/** Texto do primeiro bloco de conteúdo de uma resposta de tool. */
export function textOf(result: { content: Array<{ type: string; text: string }> }): string {
  return result.content[0].text;
}
