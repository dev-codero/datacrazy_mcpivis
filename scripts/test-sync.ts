// scripts/test-sync.ts
// Testa o sync n8n via MCP client. Primeiro DRY-RUN, depois real.

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";

const cfg = loadConfig();
console.log("Loaded config:");
console.log("  mcpUrl:", cfg.mcpUrl);
console.log("  n8nDryRun:", cfg.n8nDryRun);
console.log("  safeMode:", cfg.safeMode);
console.log("");

const mcp = new McpClient(cfg);

// LeadId que já validamos anteriormente (Marques ⚽😍🥶)
const LEAD_ID = "d5b0e476-5b6b-49b9-af28-408ef3515af6";

async function main() {
  console.log("=== STEP 1: DRY-RUN (lead qualificado) ===\n");

  // Simula o que o tool faz
  const lead = (await mcp.callTool("lead_get", { id: LEAD_ID })) as Record<string, unknown>;
  console.log("Lead buscado do CRM:");
  console.log("  name:", lead.name);
  console.log("  phone:", lead.phone);
  console.log("  rawPhone:", lead.rawPhone);
  console.log("  email:", lead.email);
  console.log("  additionalFields:", JSON.stringify(lead.additionalFields, null, 2));
  console.log("");

  const list = (await mcp.callTool("lead_list_businesses", { leadId: LEAD_ID })) as {
    data?: Array<Record<string, unknown>>;
  };
  console.log("Business do lead:");
  console.log(JSON.stringify(list.data, null, 2));
  console.log("");

  // Constrói payload (mesma lógica do tool)
  function pickPhone(): string | undefined {
    return (lead.rawPhone as string) || (lead.phone as string);
  }
  function pickGclid(): string | undefined {
    const lc = ["gclid", "wbraid", "gbraid", "pageid"];
    const fields = (lead.additionalFields as Array<Record<string, unknown>>) ?? [];
    for (const f of fields) {
      const af = f.additionalField as { name?: string } | undefined;
      const name = af?.name?.toLowerCase();
      if (name && lc.includes(name)) {
        const v = f.value;
        if (v !== null && v !== undefined && v !== "") return String(v);
      }
    }
    return undefined;
  }

  const business = list.data?.[0];
  const payload = {
    etapa: "Orcamento Enviado",
    planilha_destino: "NOVA_LUZ_LEAD_QUALIFICADO",
    telefone: pickPhone(),
    email: lead.email,
    gclid: pickGclid(),
    valor: business?.total,
    lead: { id: lead.id, name: lead.name },
  };
  console.log("=== PAYLOAD QUE SERIA ENVIADO ===");
  console.log(JSON.stringify(payload, null, 2));
  console.log("");

  console.log("=== STEP 2: ENVIO REAL (dryRun=false) ===\n");
  const url = new URL(cfg.n8nWebhookUrl);
  for (const [k, v] of Object.entries({
    etapa: payload.etapa,
    telefone: payload.telefone,
    email: payload.email,
    gclid: payload.gclid,
    valor: payload.valor,
  })) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  console.log("URL:", url.toString());
  const res = await fetch(url.toString(), { method: "POST" });
  const body = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", body);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
