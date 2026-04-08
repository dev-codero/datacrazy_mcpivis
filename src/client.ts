import { Config } from "./config.js";

export class DataCrazyClient {
  constructor(private config: Config) {}

  private get headers(): Record<string, string> {
    return {
      "access-token": this.config.apiToken,
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
    const res = await fetch(url.toString(), { headers: this.headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: "POST",
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async put<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async delete<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: "DELETE",
      headers: this.headers,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }
}
