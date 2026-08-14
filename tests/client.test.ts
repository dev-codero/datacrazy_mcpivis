import { describe, it, expect, vi } from "vitest";
import { DataCrazyClient } from "../src/client.js";
import { makeConfig, mockFetch, jsonResponse } from "./helpers.js";

describe("DataCrazyClient", () => {
  it("envia access-token E Authorization Bearer (compat entre tokens antigos e dc_)", async () => {
    const { calls } = mockFetch(() => jsonResponse({ ok: true }));
    const client = new DataCrazyClient(makeConfig({ apiToken: "dc_abc123" }));

    await client.get("/api/v1/tags");

    expect(calls[0].headers["access-token"]).toBe("dc_abc123");
    expect(calls[0].headers.Authorization).toBe("Bearer dc_abc123");
  });

  it("monta a URL a partir de apiUrl + path", async () => {
    const { calls } = mockFetch(() => jsonResponse({}));
    const client = new DataCrazyClient(makeConfig({ apiUrl: "https://api.test.local" }));

    await client.get("/api/v1/tags");

    expect(calls[0].url).toBe("https://api.test.local/api/v1/tags");
  });

  it("serializa query params e descarta os undefined", async () => {
    const { calls } = mockFetch(() => jsonResponse({}));
    const client = new DataCrazyClient(makeConfig());

    await client.get("/api/v1/leads", { page: 2, limit: 50, search: undefined, active: true });

    const url = new URL(calls[0].url);
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("active")).toBe("true");
    expect(url.searchParams.has("search")).toBe(false);
  });

  it.each([
    ["post", "POST"],
    ["put", "PUT"],
    ["patch", "PATCH"],
    ["delete", "DELETE"],
  ] as const)("%s usa o verbo HTTP %s", async (method, verb) => {
    const { calls } = mockFetch(() => jsonResponse({}));
    const client = new DataCrazyClient(makeConfig());

    if (method === "delete") await client.delete("/api/v1/tags/1");
    else await client[method]("/api/v1/tags", { name: "x" });

    expect(calls[0].method).toBe(verb);
  });

  it("manda o body como JSON no post", async () => {
    const { calls } = mockFetch(() => jsonResponse({}));
    const client = new DataCrazyClient(makeConfig());

    await client.post("/api/v1/tags", { name: "quente", color: "#FF0000" });

    expect(calls[0].body).toEqual({ name: "quente", color: "#FF0000" });
  });

  it("omite o body no post quando nao ha nada para enviar", async () => {
    const { calls } = mockFetch(() => jsonResponse({}));
    const client = new DataCrazyClient(makeConfig());

    await client.post("/api/v1/algum-trigger");

    expect(calls[0].body).toBeUndefined();
  });

  it("lanca erro com status e corpo quando a resposta nao e ok", async () => {
    mockFetch(() => new Response("lead nao encontrado", { status: 404 }));
    const client = new DataCrazyClient(makeConfig());

    await expect(client.get("/api/v1/leads/nope")).rejects.toThrow(
      /DataCrazy API error 404: lead nao encontrado/,
    );
  });

  it("propaga o erro tambem nos verbos de escrita", async () => {
    mockFetch(() => new Response("forbidden", { status: 403 }));
    const client = new DataCrazyClient(makeConfig());

    await expect(client.delete("/api/v1/tags/1")).rejects.toThrow(/403/);
  });

  // Regressao: o DataCrazy responde 204 sem corpo nos DELETE bem-sucedidos.
  // Antes de 2026-08-13 o cliente chamava res.json() direto e lancava
  // "Unexpected end of JSON input" — toda exclusao que funcionava era
  // reportada ao usuario como erro. Descoberto apagando 20 negocios de teste.
  it("nao explode com 204 No Content (delete bem-sucedido)", async () => {
    mockFetch(() => new Response(null, { status: 204 }));
    const client = new DataCrazyClient(makeConfig());

    await expect(client.delete("/api/v1/businesses/1")).resolves.toBeUndefined();
  });

  it("nao explode com 200 e corpo vazio", async () => {
    mockFetch(() => new Response("", { status: 200 }));
    const client = new DataCrazyClient(makeConfig());

    await expect(client.delete("/api/v1/businesses/1")).resolves.toBeUndefined();
  });

  it("nao explode com corpo so de espacos em branco", async () => {
    mockFetch(() => new Response("   \n  ", { status: 200 }));
    const client = new DataCrazyClient(makeConfig());

    await expect(client.get("/api/v1/algo")).resolves.toBeUndefined();
  });

  it("devolve texto cru quando o corpo 2xx nao e JSON", async () => {
    mockFetch(() => new Response("OK", { status: 200 }));
    const client = new DataCrazyClient(makeConfig());

    await expect(client.post("/api/v1/algum-trigger")).resolves.toBe("OK");
  });

  it.each(["get", "post", "put", "patch", "delete"] as const)(
    "%s tolera corpo vazio",
    async (metodo) => {
      mockFetch(() => new Response(null, { status: 204 }));
      const client = new DataCrazyClient(makeConfig());

      const chamada =
        metodo === "get" || metodo === "delete"
          ? client[metodo]("/api/v1/x")
          : client[metodo]("/api/v1/x", { a: 1 });

      await expect(chamada).resolves.toBeUndefined();
    },
  );

  it("devolve o JSON deserializado no caminho feliz", async () => {
    mockFetch(() => jsonResponse({ data: [{ id: "1", name: "quente" }] }));
    const client = new DataCrazyClient(makeConfig());

    const result = await client.get<{ data: Array<{ id: string }> }>("/api/v1/tags");

    expect(result.data[0].id).toBe("1");
  });
});

/**
 * O REST do DataCrazy limita por cota: 60 requisicoes por janela fixa de ~60s,
 * global por token. Estourar em operacao de lote e o normal, nao a excecao —
 * antes disso o lote simplesmente morria com "DataCrazy API error 429".
 */
describe("retry em 429", () => {
  it("respeita o Retry-After e reenvia", async () => {
    vi.useFakeTimers();
    try {
      const { calls } = mockFetch((_call, index) =>
        index === 0
          ? new Response("rate limited", { status: 429, headers: { "retry-after": "2" } })
          : jsonResponse({ ok: true }),
      );
      const client = new DataCrazyClient(makeConfig());

      const promessa = client.get("/api/v1/tags");
      await vi.advanceTimersByTimeAsync(2_100);
      await expect(promessa).resolves.toMatchObject({ ok: true });
      expect(calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("desiste depois de esgotar as tentativas e propaga o 429", async () => {
    vi.useFakeTimers();
    try {
      const { calls } = mockFetch(() => new Response("nope", { status: 429, headers: { "retry-after": "1" } }));
      const client = new DataCrazyClient(makeConfig());

      const promessa = client.get("/api/v1/tags");
      const capturada = promessa.catch((e: Error) => e);
      await vi.advanceTimersByTimeAsync(10_000);

      expect(String((await capturada as Error).message)).toMatch(/429/);
      // 1 original + 3 retries
      expect(calls).toHaveLength(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("usa backoff quando nao ha Retry-After", async () => {
    vi.useFakeTimers();
    try {
      const { calls } = mockFetch((_call, index) =>
        index === 0 ? new Response("", { status: 429 }) : jsonResponse({ ok: true }),
      );
      const client = new DataCrazyClient(makeConfig());

      const promessa = client.get("/api/v1/tags");
      await vi.advanceTimersByTimeAsync(5_100);
      await expect(promessa).resolves.toMatchObject({ ok: true });
      expect(calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("NAO faz retry de 4xx que nao seja 429", async () => {
    const { calls } = mockFetch(() => new Response("nao existe", { status: 404 }));
    const client = new DataCrazyClient(makeConfig());

    await expect(client.get("/api/v1/leads/x")).rejects.toThrow(/404/);
    expect(calls).toHaveLength(1);
  });

  it("faz retry tambem nos verbos de escrita", async () => {
    vi.useFakeTimers();
    try {
      const { calls } = mockFetch((_call, index) =>
        index === 0
          ? new Response("", { status: 429, headers: { "retry-after": "1" } })
          : new Response(null, { status: 204 }),
      );
      const client = new DataCrazyClient(makeConfig());

      const promessa = client.delete("/api/v1/businesses/1");
      await vi.advanceTimersByTimeAsync(1_100);
      await expect(promessa).resolves.toBeUndefined();
      expect(calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
