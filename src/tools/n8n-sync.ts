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

function pickAdditionalField(
  lead: LeadResumo,
  candidates: string[],
): string | undefined {
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
  payload: Record<string, string | number | undefined>,
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

export function registerN8nSyncTools(server: McpServer, mcp: McpClient, config: Config) {
  // ─── Lead qualificado → NOVA_LUZ_LEAD_QUALIFICADO ───────────────────────
  server.tool(
    "n8n_sync_lead_qualificado",
    "Busca lead/business no CRM e envia para o webhook n8n (planilha NOVA_LUZ_LEAD_QUALIFICADO). dryRun=true por padrão — só envia se você setar explicitamente.",
    {
      leadId: z.string().describe("ID do lead no CRM (obrigatorio)"),
      businessId: z.string().optional().describe("ID do business (opcional, pra puxar valor)"),
      confirm: z.boolean().optional().describe("Confirmar envio (necessario em SAFE_MODE)"),
      dryRun: z
        .boolean()
        .optional()
        .describe("Se true, apenas LOGA o payload. Default: true. Setar false para enviar."),
    },
    async (params) => {
      const check = requireConfirmation(config, params.confirm, "n8n_sync_lead_qualificado");
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
        etapa: ETAPA_QUALIFICADO,
        planilha: "NOVA_LUZ_LEAD_QUALIFICADO",
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
                2,
              ),
            },
          ],
        };
      }

      const result = await postToN8n(config.n8nWebhookUrl, {
        etapa: ETAPA_QUALIFICADO,
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
              2,
            ),
          },
        ],
      };
    },
  );

  // ─── Lead convertido → NOVA_LUZ_LEAD_CONVERTIDO ────────────────────────
  server.tool(
    "n8n_sync_lead_convertido",
    "Busca lead/business no CRM e envia para o webhook n8n (planilha NOVA_LUZ_LEAD_CONVERTIDO). dryRun=true por padrão — só envia se você setar explicitamente.",
    {
      leadId: z.string().describe("ID do lead no CRM (obrigatorio)"),
      businessId: z.string().optional().describe("ID do business (opcional, pra puxar valor)"),
      confirm: z.boolean().optional().describe("Confirmar envio (necessario em SAFE_MODE)"),
      dryRun: z
        .boolean()
        .optional()
        .describe("Se true, apenas LOGA o payload. Default: true. Setar false para enviar."),
    },
    async (params) => {
      const check = requireConfirmation(config, params.confirm, "n8n_sync_lead_convertido");
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
        etapa: ETAPA_CONVERTIDO,
        planilha: "NOVA_LUZ_LEAD_CONVERTIDO",
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
                2,
              ),
            },
          ],
        };
      }

      const result = await postToN8n(config.n8nWebhookUrl, {
        etapa: ETAPA_CONVERTIDO,
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
              2,
            ),
          },
        ],
      };
    },
  );
}
