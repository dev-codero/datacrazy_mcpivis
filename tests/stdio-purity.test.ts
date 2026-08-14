import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src", import.meta.url));

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/**
 * O servidor fala JSON-RPC pelo stdout. Qualquer escrita fora do protocolo corrompe
 * o stream e o cliente MCP morre com "Unexpected token". Este teste é o guarda-corpo:
 * logs em src/ têm que ir para stderr (console.error).
 */
describe("pureza do stdout (servidor MCP stdio)", () => {
  const files = tsFiles(SRC);

  it("encontra os arquivos de src/", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files.map((f) => [f.replace(`${SRC}/`, "src/"), f] as const))(
    "%s nao escreve em stdout",
    (label, file) => {
      const lines = readFileSync(file, "utf8").split("\n");
      const offenders = lines
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*"))
        .filter(({ line }) => /\bconsole\.(log|info|debug|warn)\b|\bprocess\.stdout\.write\b/.test(line));

      expect(
        offenders.map((o) => `${label}:${o.n} → ${o.line}`),
        "use console.error; stdout e reservado para o JSON-RPC",
      ).toEqual([]);
    },
  );

  it("config.ts carrega o dotenv com quiet para nao imprimir banner no stdout", () => {
    const source = readFileSync(join(SRC, "config.ts"), "utf8");
    expect(source).toMatch(/quiet:\s*true/);
  });
});
