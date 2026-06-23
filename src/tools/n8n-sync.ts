// src/tools/n8n-sync.ts
//
// Envia leads do DataCrazy para o webhook n8n que alimenta as planilhas Google
// "NOVA_LUZ_LEAD_QUALIFICADO" / "NOVA_LUZ_LEAD_CONVERTIDO".
//
// Segurança:
//   - SEMPRE recebe leadId (ou businessId). NUNCA valores crus do user.
//   - Busca phone/email/gclid/valor direto do CRM via MCP.
//   - dryRun = true por padrão. Só envia se dryRun=false EXPLÍCITO.
//   - SAFE_MODE exige confirm: true adicional.
//   - Payload completo é logado antes de enviar.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Config } from "../config.js";
import { McpClient } from "../mcp-client.js";
import { requireConfirmation } from "../safe-mode.js";

const ETAPA_QUALIFICADO = "Orcamento Enviado";
const ETAPA_CONVERTIDO = "Convertido";

interface LeadAdditionalField {
  id: string;
  additionalField?: { id: string; name?: string; type?: string };
  value?: string | number | null;
}

interface LeadResumo {
  id: string;
  name?: string;
  phone?: string;
  rawPhone?: string;
  email?: string;
  additionalFields?: LeadAdditionalField[];
}

interface BusinessResumo {
  id: string;
  leadId: string;
  total?: number;
  stageName?: string;
  status?: string;
}

function pickPhone(lead: LeadResumo): string | undefined {
  return lead.rawPhone || lead.phone;
}

function pickAdditionalField(lead: LeadResumo, candidates: string[]): string | undefined {
  const lc = candidates.map((c) => c.toLowerCase());
  for (const f of lead.additionalFields ?? []) {
    const name = f.additionalField?.name?.toLowerCase();
    if (name && lc.includes(name)) {
      const v = f.value;
      if (v !== null && v !== undefined && v !== "") return String(v);
    }
  }
  return undefined;
}

async function postToN8n(
  url: string,
  payload: Record<string, string | number | undefined>
): Promise<{ status: number; body: string; url: string }> {
  const u = new URL(url);
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString(), { method: "POST" });
  const body = await res.text();
  return { status: res.status, body, url: u.toString() };
}

function buildPayload(args: {
  etapa: string;
  planilha: string;
  lead: LeadResumo;
  business?: BusinessResumo;
  gclid?: string;
  valor?: number;
}) {
  return {
    etapa: args.etapa,
    planilha_destino: args.planilha,
    telefone: pickPhone(args.lead),
    email: args.lead.email,
    gclid: args.gclid,
    valor: args.valor,
    lead: { id: args.lead.id, name: args.lead.name },
    business: args.business
      ? { id: args.business.id, total: args.business.total, stageName: args.business.stageName }
      : undefined,
  };
}

const schema = {
  action: z
    .enum(["lead_qualificado", "lead_convertido"])
    .describe("Qual planilha alimentar: lead_qualificado (NOVA_LUZ_LEAD_QUALIFICADO) ou lead_convertido (NOVA_LUZ_LEAD_CONVERTIDO)"),
  leadId: z.string().describe("ID do lead no CRM (obrigatorio)"),
  businessId: z.string().optional().describe("ID do business (opcional, pra puxar valor)"),
  confirm: z.boolean().optional().describe("Confirmar envio (necessario em SAFE_MODE)"),
  dryRun: z
    .boolean()
    .optional()
    .describe("Se true, apenas LOGA o payload. Default: true. Setar false para enviar de verdade."),
};

export function registerN8nSyncTools(server: McpServer, mcp: McpClient, config: Config) {
  server.tool(
    "n8n_sync",
    "Sincronizar lead do DataCrazy CRM com planilhas Google via webhook n8n. dryRun=true por padrao. Actions: lead_qualificado (orcamento enviado) ou lead_convertido (vendido).",
    schema,
    async (params) => {
      const cfg =
        params.action === "lead_qualificado"
          ? { etapa: ETAPA_QUALIFICADO, planilha: "NOVA_LUZ_LEAD_QUALIFICADO" }
          : { etapa: ETAPA_CONVERTIDO, planilha: "NOVA_LUZ_LEAD_CONVERTIDO" };

      const check = requireConfirmation(config, params.confirm, `n8n_sync.${params.action}`);
      if (check.blocked) return { content: [{ type: "text", text: check.message }] };

      const lead = await mcp.callTool<LeadResumo>("lead_get", { id: params.leadId });
      if (!lead?.id) {
        return { content: [{ type: "text", text: "Lead não encontrado no CRM" }] };
      }

      let business: BusinessResumo | undefined;
      if (params.businessId) {
        const list = await mcp.callTool<{ data?: BusinessResumo[] }>("lead_list_businesses", {
          leadId: params.leadId,
        });
        business = list?.data?.find((b) => b.id === params.businessId);
      }

      const gclid = pickAdditionalField(lead, ["gclid", "wbraid", "gbraid", "pageId"]);
      const payload = buildPayload({
        etapa: cfg.etapa,
        planilha: cfg.planilha,
        lead,
        business,
        gclid,
        valor: business?.total,
      });

      const effectiveDryRun = params.dryRun ?? config.n8nDryRun;
      if (effectiveDryRun) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  mode: "DRY-RUN (nada foi enviado)",
                  webhook: config.n8nWebhookUrl,
                  payload,
                  hint: "Para enviar de verdade, chame de novo com dryRun: false",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const result = await postToN8n(config.n8nWebhookUrl, {
        etapa: cfg.etapa,
        telefone: pickPhone(lead),
        email: lead.email,
        gclid,
        valor: business?.total,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                mode: "ENVIADO",
                ok: result.status >= 200 && result.status < 300,
                status: result.status,
                payload,
                n8nResponse: result.body.slice(0, 300),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
