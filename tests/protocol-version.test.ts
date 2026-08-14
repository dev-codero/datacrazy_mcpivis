import { describe, it, expect } from "vitest";
import { LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";
import { MCP_PROTOCOL_VERSION } from "../src/mcp-client.js";

/**
 * O servidor negocia a versao do protocolo sozinho (o SDK cuida disso), mas o
 * McpClient em src/mcp-client.ts e artesanal e anuncia a versao na mao.
 *
 * Sem este teste, o SDK sobe numa atualizacao de dependencia e o nosso cliente
 * fica falando uma revisao velha em silencio — foi exatamente o que aconteceu:
 * ficou preso em 2024-11-05 enquanto o SDK ja suportava 2025-11-25.
 */
describe("versao do protocolo MCP", () => {
  it("o cliente artesanal anuncia a versao mais nova que o SDK suporta", () => {
    expect(
      MCP_PROTOCOL_VERSION,
      `o SDK agora suporta ${LATEST_PROTOCOL_VERSION}. Suba MCP_PROTOCOL_VERSION em src/mcp-client.ts ` +
        "e confirme contra o MCP do DataCrazy antes de commitar.",
    ).toBe(LATEST_PROTOCOL_VERSION);
  });

  it("a versao anunciada esta na lista de suportadas pelo SDK", () => {
    expect(SUPPORTED_PROTOCOL_VERSIONS).toContain(MCP_PROTOCOL_VERSION);
  });

  it("documenta que a spec 2026-07-28 ainda nao tem suporte de SDK", () => {
    // Guarda-corpo: quando o SDK ganhar 2026-07-28 (core stateless, MCP Apps,
    // MCP Tasks, OAuth 2.0/OIDC), este teste falha e lembra de avaliar a migracao.
    // Ver a secao "MCP connector da Anthropic" em docs/agent/context.md.
    expect(
      SUPPORTED_PROTOCOL_VERSIONS,
      "o SDK passou a suportar 2026-07-28 — hora de avaliar migrar para a spec nova",
    ).not.toContain("2026-07-28");
  });
});
