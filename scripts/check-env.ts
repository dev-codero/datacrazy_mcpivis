// scripts/check-env.ts
import { loadConfig } from "../src/config.js";

try {
  const cfg = loadConfig();
  console.log("OK");
  console.log("apiToken prefix:", cfg.apiToken.slice(0, 20));
  console.log("apiUrl:", cfg.apiUrl);
  console.log("safeMode:", cfg.safeMode);
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.log("ERR:", msg);
}
