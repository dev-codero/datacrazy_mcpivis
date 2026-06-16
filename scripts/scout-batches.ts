// scripts/scout-batches.ts
// Para as stages alvo, amostra os primeiros 5 negocios e valida os dados do lead.
// Não envia nada.

import { loadConfig } from "../src/config.js";
import { McpClient } from "../src/mcp-client.js";

const cfg = loadConfig();
const mcp = new McpClient(cfg);

const STAGE_ORCAMENTO = "cfc192bd-9a14-4a68-8d07-d74a83f7199f"; // Vendas → Orçamento
const STAGE_FINALIZADO = "33b14c90-4d8a-45c8-b98a-12770ead38b6"; // Vendas → Finalizado
const STAGE_GANHO = "f07f4cef-bdc8-4a67-bd77-5b292a76e653"; // Vendas B2B → Ganho

async function sample(stageId: string, label: string, n: number) {
  console.log(`\n=== ${label} (sample ${n}) ===`);
  const r = (await mcp.callTool("business_list_by_stage", { stageId, take: n })) as {
    data?: Array<Record<string, unknown>>;
  };
  for (const b of r.data ?? []) {
    const leadId = b.leadId as string | undefined;
    if (!leadId) {
      console.log(`  ${b.id}  (sem leadId)  ${JSON.stringify(b).slice(0, 100)}`);
      continue;
    }
    const lead = (await mcp.callTool("lead_get", { id: leadId })) as Record<string, unknown>;
    const af = (lead.additionalFields as Array<{
      additionalField?: { name?: string };
      value?: unknown;
    }>) ?? [];
    const gclid = af.find((f) =>
      ["gclid", "wbraid", "gbraid", "pageid"].includes(
        (f.additionalField?.name ?? "").toLowerCase(),
      ),
    )?.value;
    console.log(
      `  biz=${b.id}  lead=${lead.name}  phone=${lead.phone}  email=${lead.email || "(vazio)"}  gclid=${gclid ?? "(nenhum)"}  total=${b.total ?? "(nenhum)"}`,
    );
  }
}

await sample(STAGE_ORCAMENTO, "ORCAMENTO (qualificado)", 5);
await sample(STAGE_FINALIZADO, "FINALIZADO (convertido)", 5);
await sample(STAGE_GANHO, "GANHO (convertido)", 5);
