// src/mcp-client.ts
//
// Cliente MCP JSON-RPC minimal, com SSE streaming.
// Aponta para o MCP oficial do DataCrazy (mcp.g1.datacrazy.io/api/mcp).
// Implementa só o que precisamos: initialize + tools/call.

import { Config } from "./config.js";

/**
 * Versao do protocolo MCP que anunciamos ao MCP oficial do DataCrazy.
 *
 * Este cliente e artesanal (nao usa o SDK), entao a versao nao e negociada
 * automaticamente como no servidor — precisa ser subida na mao aqui.
 *
 * Mantida em sincronia com LATEST_PROTOCOL_VERSION do @modelcontextprotocol/sdk.
 * O teste em tests/protocol-version.test.ts falha quando o SDK avanca e isto nao.
 *
 * Nota: a spec 2026-07-28 (core stateless, MCP Apps, MCP Tasks, OAuth 2.0/OIDC)
 * ainda nao e suportada por nenhum SDK publicado — o teto do SDK 1.30.0 e 2025-11-25.
 */
export const MCP_PROTOCOL_VERSION = "2025-11-25";

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

/**
 * O MCP do DataCrazy reporta falha de aplicacao DENTRO do payload de sucesso,
 * nao como erro JSON-RPC. Exemplos medidos em 2026-08-13:
 *
 *   lead_update_attendant  →  {"error":"Attendant was not found for the given userId."}
 *   lead_add_tag (duplicada) →  {"error":"Internal server error"}
 *
 * Sem esta checagem o cliente devolvia esses objetos como se fossem sucesso, e
 * quem chamou — inclusive o LLM do outro lado do servidor — recebia a operacao
 * como concluida. Foi assim que uma atribuicao de atendente "funcionou" 600
 * vezes sem atribuir nada.
 *
 * Conservador de proposito: so trata como erro quando o payload e claramente um
 * envelope de erro (campo `error` textual, sem dado util junto) ou quando o
 * proprio protocolo marcou `isError`.
 */
function assertSemErroNoPayload(tool: string, payload: unknown, isError?: boolean): void {
  if (payload === null || typeof payload !== "object") return;

  const obj = payload as Record<string, unknown>;
  const erro = obj.error;
  const temErroTextual = typeof erro === "string" && erro.trim().length > 0;
  const temErroObjeto = erro !== null && typeof erro === "object" && "message" in (erro as object);

  if (!temErroTextual && !temErroObjeto && !isError) return;

  // Um payload com `error` E dados uteis nao e um envelope de erro — pode ser
  // um registro que por acaso tem esse campo. So barramos o envelope puro.
  const chavesUteis = Object.keys(obj).filter((k) => k !== "error" && k !== "isError" && k !== "statusCode");
  if (!isError && chavesUteis.length > 0) return;

  const msg = temErroTextual
    ? (erro as string)
    : temErroObjeto
      ? String((erro as { message?: unknown }).message)
      : JSON.stringify(payload).slice(0, 200);
  throw new Error(`MCP tool "${tool}" falhou: ${msg}`);
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
        protocolVersion: MCP_PROTOCOL_VERSION,
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
    const result = res.result as { content?: Array<{ type: string; text?: string }>; isError?: boolean };
    const text = result?.content?.find((c) => c.type === "text")?.text;
    if (text === undefined) {
      assertSemErroNoPayload(name, result);
      return result as T;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      if (result.isError) throw new Error(`MCP tool "${name}" falhou: ${text}`);
      return text as unknown as T;
    }
    assertSemErroNoPayload(name, parsed, result.isError);
    return parsed as T;
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
