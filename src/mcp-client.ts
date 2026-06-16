// src/mcp-client.ts
//
// Cliente MCP JSON-RPC minimal, com SSE streaming.
// Aponta para o MCP oficial do DataCrazy (mcp.g1.datacrazy.io/api/mcp).
// Implementa só o que precisamos: initialize + tools/call.

import { Config } from "./config.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class McpClient {
  private sessionId?: string;
  private nextId = 1;
  private initialized = false;

  constructor(private config: Config) {}

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
  }

  /** Inicializa a sessão MCP (idempotente). */
  private async ensureInit(): Promise<void> {
    if (this.initialized) return;
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mcp-datacrazy", version: "1.0.0" },
      },
    };
    const res = await this.send(req);
    if (res.error) throw new Error(`MCP init error: ${res.error.message}`);
    this.initialized = true;
  }

  /** Chama uma tool. Retorna o conteúdo deserializado (já parseado se JSON). */
  async callTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    await this.ensureInit();
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "tools/call",
      params: { name, arguments: args },
    };
    const res = await this.send(req);
    if (res.error) throw new Error(`MCP tool error: ${res.error.message}`);

    // O MCP retorna { content: [{ type: "text", text: "..." }] }
    const result = res.result as { content?: Array<{ type: string; text?: string }> };
    const text = result?.content?.find((c) => c.type === "text")?.text;
    if (text === undefined) return result as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  private async send(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const headers = { ...this.headers };
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;

    const res = await fetch(this.config.mcpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MCP HTTP ${res.status}: ${body}`);
    }

    // Captura session id
    const sid = res.headers.get("mcp-session-id");
    if (sid) this.sessionId = sid;

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      return (await this.parseSse(res)) as JsonRpcResponse;
    }
    return (await res.json()) as JsonRpcResponse;
  }

  /** Faz o parse de uma resposta SSE, pegando o `data:` final que tem o JSON-RPC. */
  private async parseSse(res: Response): Promise<JsonRpcResponse> {
    const reader = res.body?.getReader();
    if (!reader) throw new Error("SSE: no body");
    const decoder = new TextDecoder();
    let buf = "";
    let lastData = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          lastData = line.slice(6).trim();
        }
      }
    }
    if (!lastData) throw new Error("SSE: no data received");
    return JSON.parse(lastData) as JsonRpcResponse;
  }
}
