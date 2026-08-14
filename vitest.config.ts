import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Só os testes offline. Os smoke tests de rede vivem em scripts/ e são opt-in.
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Cada arquivo isolado: os testes mexem em process.env e em globalThis.fetch.
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
