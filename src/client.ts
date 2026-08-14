import { Config } from "./config.js";

/**
 * Deserializa a resposta tolerando corpo vazio.
 *
 * O DataCrazy responde `204 No Content` (sem corpo) nos DELETE bem-sucedidos.
 * Chamar `res.json()` nesse caso lanca "Unexpected end of JSON input", e o erro
 * sobe como se a operacao tivesse falhado — quando na verdade ela funcionou.
 * Isso afetava a action `delete` de todas as tools.
 */
async function parseBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text.trim()) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Corpo nao-JSON num 2xx: devolvemos o texto cru em vez de explodir.
    return text as unknown as T;
  }
}

/**
 * Quantas vezes reenviar uma requisicao que tomou 429 antes de desistir.
 * Zero desliga o retry (util em teste).
 */
const MAX_RETRIES_429 = 3;

/** Teto de espera por tentativa, para um Retry-After absurdo nao travar o processo. */
const MAX_ESPERA_MS = 90_000;

/**
 * Reenvia a requisicao respeitando o `Retry-After` quando a API devolve 429.
 *
 * O REST do DataCrazy limita por COTA, nao por taxa: 60 requisicoes por janela
 * fixa de ~60s, global por token (medido em 2026-08-13). Estourar a cota nao e
 * excepcional em operacao de lote — e o comportamento normal ao processar mais
 * de 60 registros. Sem isso, o chamador recebia `DataCrazy API error 429` e o
 * lote morria no meio.
 *
 * Nao faz retry de nenhum outro status: um 400 ou 404 nao melhora com espera.
 */
async function comRetry429(enviar: () => Promise<Response>): Promise<Response> {
  let res = await enviar();

  for (let tentativa = 0; res.status === 429 && tentativa < MAX_RETRIES_429; tentativa++) {
    const cabecalho = res.headers.get("retry-after");
    const segundos = cabecalho ? Number(cabecalho) : NaN;
    // Sem Retry-After utilizavel, recua exponencialmente a partir de 5s.
    const esperaMs = Number.isFinite(segundos) && segundos > 0 ? segundos * 1000 : 5_000 * 2 ** tentativa;

    await new Promise((r) => setTimeout(r, Math.min(esperaMs, MAX_ESPERA_MS)));
    res = await enviar();
  }

  return res;
}

export class DataCrazyClient {
  constructor(private config: Config) {}

  private get headers(): Record<string, string> {
    return {
      "access-token": this.config.apiToken,
      Authorization: `Bearer ${this.config.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  async get<T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = new URL(`${this.config.apiUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    const res = await comRetry429(() => fetch(url.toString(), { headers: this.headers }));
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${body}`);
    }
    return parseBody<T>(res);
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await comRetry429(() =>
      fetch(`${this.config.apiUrl}${path}`, {
      method: "POST",
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
      }),
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${text}`);
    }
    return parseBody<T>(res);
  }

  async put<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await comRetry429(() =>
      fetch(`${this.config.apiUrl}${path}`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body),
      }),
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${text}`);
    }
    return parseBody<T>(res);
  }

  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await comRetry429(() =>
      fetch(`${this.config.apiUrl}${path}`, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify(body),
      }),
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${text}`);
    }
    return parseBody<T>(res);
  }

  async delete<T = unknown>(path: string): Promise<T> {
    const res = await comRetry429(() =>
      fetch(`${this.config.apiUrl}${path}`, {
      method: "DELETE",
      headers: this.headers,
      }),
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${text}`);
    }
    return parseBody<T>(res);
  }
}
