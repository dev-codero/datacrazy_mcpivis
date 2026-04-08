#!/usr/bin/env node

// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// src/config.ts
function loadConfig() {
  const apiToken = process.env.DATACRAZY_API_TOKEN;
  if (!apiToken) {
    throw new Error("DATACRAZY_API_TOKEN environment variable is required");
  }
  return {
    apiToken,
    apiUrl: process.env.DATACRAZY_API_URL || "https://api.datacrazy.io/v1",
    safeMode: process.env.SAFE_MODE !== "false"
  };
}

// src/client.ts
var DataCrazyClient = class {
  constructor(config2) {
    this.config = config2;
  }
  get headers() {
    return {
      "access-token": this.config.apiToken,
      "Content-Type": "application/json"
    };
  }
  async get(path, params) {
    const url = new URL(`${this.config.apiUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== void 0) url.searchParams.set(key, String(value));
      }
    }
    const res = await fetch(url.toString(), { headers: this.headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${body}`);
    }
    return res.json();
  }
  async post(path, body) {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: "POST",
      headers: this.headers,
      body: body ? JSON.stringify(body) : void 0
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${text}`);
    }
    return res.json();
  }
  async put(path, body) {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${text}`);
    }
    return res.json();
  }
  async patch(path, body) {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${text}`);
    }
    return res.json();
  }
  async delete(path) {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: "DELETE",
      headers: this.headers
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DataCrazy API error ${res.status}: ${text}`);
    }
    return res.json();
  }
};

// src/tools/leads.ts
import { z } from "zod";

// src/safe-mode.ts
function requireConfirmation(config2, confirm, action) {
  if (!config2.safeMode || confirm) {
    return { blocked: false };
  }
  return {
    blocked: true,
    message: `\u26A0\uFE0F SAFE_MODE ativado. Para executar "${action}", passe confirm: true. Esta acao nao pode ser desfeita.`
  };
}

// src/tools/leads.ts
function registerLeadsTools(server2, client2, config2) {
  server2.tool("list_leads", "Buscar leads com paginacao e filtros", {
    skip: z.number().optional().describe("Offset para paginacao"),
    take: z.number().optional().describe("Limite de resultados"),
    search: z.string().optional().describe("Termo de busca"),
    complete: z.boolean().optional().describe("Incluir campos adicionais")
  }, async (params) => {
    const queryParams = {
      skip: params.skip,
      take: params.take,
      search: params.search
    };
    if (params.complete) queryParams["complete[additionalFields]"] = true;
    const result = await client2.get("/api/v1/leads", queryParams);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("get_lead", "Buscar lead por ID com todos os detalhes", {
    id: z.string().describe("ID do lead"),
    complete: z.boolean().optional().describe("Incluir campos adicionais")
  }, async (params) => {
    const queryParams = {};
    if (params.complete) queryParams["complete[additionalFields]"] = true;
    const result = await client2.get(`/api/v1/leads/${params.id}`, queryParams);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("create_lead", "Criar um novo lead no CRM", {
    name: z.string().optional().describe("Nome do lead"),
    phone: z.string().optional().describe("Telefone"),
    email: z.string().optional().describe("Email"),
    company: z.string().optional().describe("Empresa"),
    taxId: z.string().optional().describe("CPF/CNPJ"),
    source: z.string().optional().describe("Origem do lead"),
    site: z.string().optional().describe("Site"),
    instagram: z.string().optional().describe("Instagram"),
    image: z.string().optional().describe("URL da imagem"),
    tags: z.array(z.string()).optional().describe("IDs das tags"),
    lists: z.array(z.string()).optional().describe("IDs das listas"),
    attendantId: z.string().optional().describe("ID do atendente responsavel")
  }, async (params) => {
    const body = {};
    if (params.name) body.name = params.name;
    if (params.phone) body.phone = params.phone;
    if (params.email) body.email = params.email;
    if (params.company) body.company = params.company;
    if (params.taxId) body.taxId = params.taxId;
    if (params.source) body.source = params.source;
    if (params.site) body.site = params.site;
    if (params.instagram) body.instagram = params.instagram;
    if (params.image) body.image = params.image;
    if (params.tags) body.tags = params.tags.map((id) => ({ id }));
    if (params.lists) body.lists = params.lists.map((id) => ({ id }));
    if (params.attendantId) body.attendant = { id: params.attendantId };
    const result = await client2.post("/api/v1/leads", body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("update_lead", "Atualizar dados de um lead existente", {
    id: z.string().describe("ID do lead"),
    name: z.string().optional().describe("Nome"),
    phone: z.string().optional().describe("Telefone"),
    email: z.string().optional().describe("Email"),
    company: z.string().optional().describe("Empresa"),
    taxId: z.string().optional().describe("CPF/CNPJ"),
    source: z.string().optional().describe("Origem"),
    site: z.string().optional().describe("Site"),
    instagram: z.string().optional().describe("Instagram"),
    tags: z.array(z.string()).optional().describe("IDs das tags"),
    lists: z.array(z.string()).optional().describe("IDs das listas"),
    attendantId: z.string().optional().describe("ID do atendente")
  }, async (params) => {
    const { id, ...rest } = params;
    const body = {};
    if (rest.name) body.name = rest.name;
    if (rest.phone) body.phone = rest.phone;
    if (rest.email) body.email = rest.email;
    if (rest.company) body.company = rest.company;
    if (rest.taxId) body.taxId = rest.taxId;
    if (rest.source) body.source = rest.source;
    if (rest.site) body.site = rest.site;
    if (rest.instagram) body.instagram = rest.instagram;
    if (rest.tags) body.tags = rest.tags.map((tid) => ({ id: tid }));
    if (rest.lists) body.lists = rest.lists.map((lid) => ({ id: lid }));
    if (rest.attendantId) body.attendant = { id: rest.attendantId };
    const result = await client2.patch(`/api/v1/leads/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("delete_lead", "Excluir um lead do CRM (irreversivel)", {
    id: z.string().describe("ID do lead"),
    confirm: z.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)")
  }, async (params) => {
    const check = requireConfirmation(config2, params.confirm, "delete_lead");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client2.delete(`/api/v1/leads/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/lead-attachments.ts
import { z as z2 } from "zod";
function registerLeadAttachmentsTools(server2, client2, config2) {
  server2.tool("list_lead_attachments", "Buscar arquivos anexados a um lead", {
    leadId: z2.string().describe("ID do lead")
  }, async (params) => {
    const result = await client2.get(`/api/v1/leads/${params.leadId}/attachments`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("add_lead_attachment", "Adicionar arquivo anexo a um lead", {
    leadId: z2.string().describe("ID do lead"),
    attachmentUrl: z2.string().describe("URL do arquivo"),
    fileName: z2.string().describe("Nome do arquivo"),
    fileSize: z2.number().describe("Tamanho em bytes"),
    description: z2.string().optional().describe("Descricao do arquivo")
  }, async (params) => {
    const body = {
      attachmentUrl: params.attachmentUrl,
      fileName: params.fileName,
      fileSize: params.fileSize,
      description: params.description
    };
    const result = await client2.post(`/api/v1/leads/${params.leadId}/attachments`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("delete_lead_attachment", "Remover arquivo anexado de um lead", {
    leadId: z2.string().describe("ID do lead"),
    id: z2.string().describe("ID do anexo"),
    confirm: z2.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)")
  }, async (params) => {
    const check = requireConfirmation(config2, params.confirm, "delete_lead_attachment");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client2.delete(`/api/v1/leads/${params.leadId}/attachments/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/lead-notes.ts
import { z as z3 } from "zod";
function registerLeadNotesTools(server2, client2, config2) {
  server2.tool("list_lead_notes", "Buscar comentarios/anotacoes de um lead", {
    leadId: z3.string().describe("ID do lead")
  }, async (params) => {
    const result = await client2.get(`/api/v1/leads/${params.leadId}/notes`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("add_lead_note", "Adicionar comentario a um lead", {
    leadId: z3.string().describe("ID do lead"),
    note: z3.string().describe("Texto do comentario")
  }, async (params) => {
    const result = await client2.post(`/api/v1/leads/${params.leadId}/notes`, { note: params.note });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("update_lead_note", "Atualizar comentario de um lead", {
    leadId: z3.string().describe("ID do lead"),
    id: z3.string().describe("ID do comentario"),
    note: z3.string().describe("Novo texto do comentario")
  }, async (params) => {
    const result = await client2.put(`/api/v1/leads/${params.leadId}/notes/${params.id}`, { note: params.note });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("delete_lead_note", "Excluir comentario de um lead", {
    leadId: z3.string().describe("ID do lead"),
    id: z3.string().describe("ID do comentario"),
    confirm: z3.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)")
  }, async (params) => {
    const check = requireConfirmation(config2, params.confirm, "delete_lead_note");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client2.delete(`/api/v1/leads/${params.leadId}/notes/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/lead-history.ts
import { z as z4 } from "zod";
function registerLeadHistoryTools(server2, client2, _config) {
  server2.tool("get_lead_history", "Buscar historico de alteracoes de um lead", {
    id: z4.string().describe("ID do lead"),
    skip: z4.number().optional().describe("Offset para paginacao"),
    take: z4.number().optional().describe("Limite de resultados"),
    search: z4.string().optional().describe("Termo de busca")
  }, async (params) => {
    const result = await client2.get(`/api/v1/leads/${params.id}/history`, {
      skip: params.skip,
      take: params.take,
      search: params.search
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/lead-activities.ts
import { z as z5 } from "zod";
function registerLeadActivitiesTools(server2, client2, _config) {
  server2.tool("list_lead_activities", "Buscar atividades vinculadas a um lead", {
    id: z5.string().describe("ID do lead"),
    skip: z5.number().optional().describe("Offset para paginacao"),
    take: z5.number().optional().describe("Limite de resultados"),
    search: z5.string().optional().describe("Termo de busca")
  }, async (params) => {
    const result = await client2.get(`/api/v1/leads/${params.id}/activities`, {
      skip: params.skip,
      take: params.take,
      search: params.search
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/lead-businesses.ts
import { z as z6 } from "zod";
function registerLeadBusinessesTools(server2, client2, _config) {
  server2.tool("list_lead_businesses", "Buscar negocios vinculados a um lead", {
    id: z6.string().describe("ID do lead"),
    skip: z6.number().optional().describe("Offset para paginacao"),
    take: z6.number().optional().describe("Limite de resultados"),
    search: z6.string().optional().describe("Termo de busca")
  }, async (params) => {
    const result = await client2.get(`/api/v1/leads/${params.id}/businesses`, {
      skip: params.skip,
      take: params.take,
      search: params.search
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/businesses.ts
import { z as z7 } from "zod";
function registerBusinessesTools(server2, client2, config2) {
  server2.tool("list_businesses", "Buscar negocios com paginacao e filtros", {
    skip: z7.number().optional().describe("Offset para paginacao"),
    take: z7.number().optional().describe("Limite de resultados"),
    search: z7.string().optional().describe("Termo de busca"),
    status: z7.string().optional().describe("Filtro por status: won, in_process, lost"),
    attendants: z7.array(z7.string()).optional().describe("IDs dos atendentes"),
    minValue: z7.number().optional().describe("Valor minimo do negocio"),
    maxValue: z7.number().optional().describe("Valor maximo do negocio"),
    startDate: z7.string().optional().describe("Data inicio (ISO 8601)"),
    endDate: z7.string().optional().describe("Data fim (ISO 8601)")
  }, async (params) => {
    const queryParams = {
      skip: params.skip,
      take: params.take,
      search: params.search
    };
    if (params.status) queryParams["filter[status]"] = params.status;
    if (params.minValue) queryParams["filter[minValue]"] = params.minValue;
    if (params.maxValue) queryParams["filter[maxValue]"] = params.maxValue;
    if (params.startDate) queryParams["filter[startDate]"] = params.startDate;
    if (params.endDate) queryParams["filter[endDate]"] = params.endDate;
    if (params.attendants) queryParams["filter[attendants]"] = params.attendants.join(",");
    const result = await client2.get("/api/v1/businesses", queryParams);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("get_business", "Buscar negocio por ID com todos os detalhes", {
    id: z7.string().describe("ID do negocio")
  }, async (params) => {
    const result = await client2.get(`/api/v1/businesses/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("create_business", "Criar um novo negocio no CRM", {
    leadId: z7.string().describe("ID do lead (obrigatorio)"),
    stageId: z7.string().describe("ID da etapa do pipeline (obrigatorio)"),
    attendantId: z7.string().optional().describe("ID do atendente responsavel"),
    externalId: z7.string().optional().describe("ID externo para integracao")
  }, async (params) => {
    const body = {
      leadId: params.leadId,
      stageId: params.stageId
    };
    if (params.attendantId) body.attendantId = params.attendantId;
    if (params.externalId) body.externalId = params.externalId;
    const result = await client2.post("/api/v1/businesses", body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("update_business", "Atualizar dados de um negocio existente", {
    id: z7.string().describe("ID do negocio"),
    leadId: z7.string().optional().describe("ID do lead"),
    stageId: z7.string().optional().describe("ID da etapa"),
    attendantId: z7.string().optional().describe("ID do atendente"),
    externalId: z7.string().optional().describe("ID externo")
  }, async (params) => {
    const { id, ...body } = params;
    const result = await client2.patch(`/api/v1/businesses/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("delete_business", "Excluir um negocio do CRM (irreversivel)", {
    id: z7.string().describe("ID do negocio"),
    confirm: z7.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)")
  }, async (params) => {
    const check = requireConfirmation(config2, params.confirm, "delete_business");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client2.delete(`/api/v1/businesses/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/business-actions.ts
import { z as z8 } from "zod";
function registerBusinessActionsTools(server2, client2, config2) {
  server2.tool("move_business", "Mover negocios para outra etapa do pipeline", {
    ids: z8.array(z8.string()).describe("IDs dos negocios"),
    destinationStageId: z8.string().describe("ID da etapa de destino")
  }, async (params) => {
    const result = await client2.post("/api/v1/businesses/actions/move", {
      ids: params.ids,
      destinationStageId: params.destinationStageId
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("win_business", "Marcar negocios como ganhos", {
    ids: z8.array(z8.string()).describe("IDs dos negocios")
  }, async (params) => {
    const result = await client2.post("/api/v1/businesses/actions/win", { ids: params.ids });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("lose_business", "Marcar negocios como perdidos (irreversivel sem restore)", {
    ids: z8.array(z8.string()).describe("IDs dos negocios"),
    lossReasonId: z8.string().describe("ID do motivo de perda"),
    justification: z8.string().optional().describe("Justificativa da perda"),
    confirm: z8.boolean().optional().describe("Confirmar acao (necessario em SAFE_MODE)")
  }, async (params) => {
    const check = requireConfirmation(config2, params.confirm, "lose_business");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const body = {
      ids: params.ids,
      lossReasonId: params.lossReasonId
    };
    if (params.justification) body.justification = params.justification;
    const result = await client2.post("/api/v1/businesses/actions/lose", body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("restore_business", "Restaurar negocios perdidos ou ganhos para em andamento", {
    ids: z8.array(z8.string()).describe("IDs dos negocios")
  }, async (params) => {
    const result = await client2.post("/api/v1/businesses/actions/restore", { ids: params.ids });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/activities.ts
import { z as z9 } from "zod";
function registerActivitiesTools(server2, client2, config2) {
  server2.tool("list_activities", "Buscar atividades com paginacao e filtros", {
    skip: z9.number().optional().describe("Offset para paginacao"),
    take: z9.number().optional().describe("Limite de resultados"),
    search: z9.string().optional().describe("Termo de busca"),
    attendantId: z9.string().optional().describe("Filtrar por atendente"),
    startDate: z9.string().optional().describe("Data inicio (ISO 8601)"),
    startDateLessThan: z9.string().optional().describe("Data fim (ISO 8601)"),
    typeId: z9.string().optional().describe("ID do tipo de atividade"),
    isCompleted: z9.boolean().optional().describe("Filtrar por concluidas/pendentes")
  }, async (params) => {
    const queryParams = {
      skip: params.skip,
      take: params.take,
      search: params.search
    };
    if (params.attendantId) queryParams["filter[attendantId]"] = params.attendantId;
    if (params.startDate) queryParams["filter[startDate]"] = params.startDate;
    if (params.startDateLessThan) queryParams["filter[startDateLessThan]"] = params.startDateLessThan;
    if (params.typeId) queryParams["filter[typeId]"] = params.typeId;
    if (params.isCompleted !== void 0) queryParams["filter[isCompleted]"] = params.isCompleted;
    const result = await client2.get("/api/v1/activities", queryParams);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("get_activity", "Buscar atividade por ID", {
    id: z9.string().describe("ID da atividade")
  }, async (params) => {
    const result = await client2.get(`/api/v1/activities/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("create_activity", "Criar uma nova atividade", {
    title: z9.string().describe("Titulo da atividade (obrigatorio)"),
    description: z9.string().optional().describe("Descricao"),
    startDate: z9.string().optional().describe("Data inicio (ISO 8601)"),
    endDate: z9.string().optional().describe("Data fim (ISO 8601)"),
    leadId: z9.string().describe("ID do lead vinculado (obrigatorio)"),
    businessId: z9.string().optional().describe("ID do negocio vinculado"),
    attendantId: z9.string().optional().describe("ID do atendente responsavel"),
    activityTypeId: z9.string().optional().describe("ID do tipo de atividade"),
    required: z9.boolean().optional().describe("Se a atividade e obrigatoria"),
    linkToStage: z9.boolean().optional().describe("Vincular a etapa do negocio")
  }, async (params) => {
    const body = {
      title: params.title,
      lead: { id: params.leadId }
    };
    if (params.description) body.description = params.description;
    if (params.startDate) body.startDate = params.startDate;
    if (params.endDate) body.endDate = params.endDate;
    if (params.businessId) body.business = { id: params.businessId };
    if (params.attendantId) body.attendant = { id: params.attendantId };
    if (params.activityTypeId) body.activityType = { id: params.activityTypeId };
    if (params.required !== void 0) body.required = params.required;
    if (params.linkToStage !== void 0) body.linkToStage = params.linkToStage;
    const result = await client2.post("/api/v1/activities", body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("update_activity", "Atualizar uma atividade existente", {
    id: z9.string().describe("ID da atividade"),
    title: z9.string().optional().describe("Titulo"),
    description: z9.string().optional().describe("Descricao"),
    startDate: z9.string().optional().describe("Data inicio (ISO 8601)"),
    endDate: z9.string().optional().describe("Data fim (ISO 8601)"),
    leadId: z9.string().optional().describe("ID do lead"),
    businessId: z9.string().optional().describe("ID do negocio"),
    attendantId: z9.string().optional().describe("ID do atendente"),
    activityTypeId: z9.string().optional().describe("ID do tipo de atividade"),
    required: z9.boolean().optional().describe("Se e obrigatoria"),
    isCompleted: z9.boolean().optional().describe("Marcar como concluida")
  }, async (params) => {
    const { id, leadId, businessId, attendantId, activityTypeId, ...rest } = params;
    const body = { ...rest };
    if (leadId) body.lead = { id: leadId };
    if (businessId) body.business = { id: businessId };
    if (attendantId) body.attendant = { id: attendantId };
    if (activityTypeId) body.activityType = { id: activityTypeId };
    const result = await client2.patch(`/api/v1/activities/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("delete_activity", "Excluir uma atividade (irreversivel)", {
    id: z9.string().describe("ID da atividade"),
    confirm: z9.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)")
  }, async (params) => {
    const check = requireConfirmation(config2, params.confirm, "delete_activity");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client2.delete(`/api/v1/activities/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/conversations.ts
import { z as z10 } from "zod";
function registerConversationsTools(server2, client2, config2) {
  server2.tool("list_conversations", "Buscar conversas com filtros", {
    skip: z10.number().optional().describe("Offset para paginacao"),
    take: z10.number().optional().describe("Limite de resultados"),
    search: z10.string().optional().describe("Termo de busca"),
    opened: z10.boolean().optional().describe("Filtrar por abertas (default: true)"),
    departments: z10.string().optional().describe("IDs dos departamentos"),
    instances: z10.string().optional().describe("IDs das instancias"),
    attendants: z10.string().optional().describe("IDs dos atendentes"),
    openWindow: z10.enum(["last24h", "all"]).optional().describe("Janela de abertura")
  }, async (params) => {
    const queryParams = {
      skip: params.skip,
      take: params.take,
      search: params.search
    };
    if (params.opened !== void 0) queryParams["filter[opened]"] = params.opened;
    if (params.departments) queryParams["filter[departments]"] = params.departments;
    if (params.instances) queryParams["filter[instances]"] = params.instances;
    if (params.attendants) queryParams["filter[attendants]"] = params.attendants;
    if (params.openWindow) queryParams["filter[openWindow]"] = params.openWindow;
    const result = await client2.get("/api/v1/conversations", queryParams);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("get_conversation_messages", "Buscar mensagens de uma conversa", {
    id: z10.string().describe("ID da conversa")
  }, async (params) => {
    const result = await client2.get(`/api/v1/conversations/${params.id}/messages`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("send_message", "Enviar mensagem em uma conversa", {
    id: z10.string().describe("ID da conversa"),
    body: z10.string().describe("Texto da mensagem"),
    repliedMessageId: z10.string().optional().describe("ID da mensagem sendo respondida"),
    scheduledDate: z10.string().optional().describe("Data para agendamento (ISO 8601)"),
    isInternal: z10.boolean().optional().describe("Se e uma nota interna (nao visivel ao contato)")
  }, async (params) => {
    const msgBody = { body: params.body };
    if (params.repliedMessageId) msgBody.repliedMessageId = params.repliedMessageId;
    if (params.scheduledDate) msgBody.scheduledDate = params.scheduledDate;
    if (params.isInternal !== void 0) msgBody.isInternal = params.isInternal;
    const result = await client2.post(`/api/v1/conversations/${params.id}/messages`, msgBody);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("finish_conversation", "Finalizar atendimento de uma conversa", {
    id: z10.string().describe("ID da conversa"),
    confirm: z10.boolean().optional().describe("Confirmar finalizacao (necessario em SAFE_MODE)")
  }, async (params) => {
    const check = requireConfirmation(config2, params.confirm, "finish_conversation");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client2.post(`/api/v1/conversations/${params.id}/finish`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/pipelines.ts
import { z as z11 } from "zod";
function registerPipelinesTools(server2, client2, _config) {
  server2.tool("list_pipelines", "Buscar todos os pipelines de vendas", {}, async () => {
    const result = await client2.get("/api/v1/pipelines");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("get_pipeline", "Buscar pipeline por ID com detalhes e permissoes", {
    id: z11.string().describe("ID do pipeline")
  }, async (params) => {
    const result = await client2.get(`/api/v1/pipelines/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("get_pipeline_stages", "Buscar etapas de um pipeline", {
    id: z11.string().describe("ID do pipeline")
  }, async (params) => {
    const result = await client2.get(`/api/v1/pipelines/${params.id}/stages`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/tags.ts
import { z as z12 } from "zod";
function registerTagsTools(server2, client2, config2) {
  server2.tool("list_tags", "Buscar todas as tags do CRM", {}, async () => {
    const result = await client2.get("/api/v1/tags");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("get_tag", "Buscar tag por ID", {
    id: z12.string().describe("ID da tag")
  }, async (params) => {
    const result = await client2.get(`/api/v1/tags/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("create_tag", "Criar uma nova tag", {
    name: z12.string().describe("Nome da tag"),
    color: z12.string().optional().describe("Cor em hex (ex: #FF0000)"),
    description: z12.string().optional().describe("Descricao da tag"),
    useRandomColor: z12.boolean().optional().describe("Usar cor aleatoria")
  }, async (params) => {
    const result = await client2.post("/api/v1/tags", params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("update_tag", "Atualizar uma tag existente", {
    id: z12.string().describe("ID da tag"),
    name: z12.string().optional().describe("Nome"),
    color: z12.string().optional().describe("Cor em hex"),
    description: z12.string().optional().describe("Descricao")
  }, async (params) => {
    const { id, ...body } = params;
    const result = await client2.put(`/api/v1/tags/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("delete_tag", "Excluir uma tag (irreversivel)", {
    id: z12.string().describe("ID da tag"),
    confirm: z12.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)")
  }, async (params) => {
    const check = requireConfirmation(config2, params.confirm, "delete_tag");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client2.delete(`/api/v1/tags/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/lists.ts
import { z as z13 } from "zod";
function registerListsTools(server2, client2, config2) {
  server2.tool("list_lists", "Buscar todas as listas do CRM", {}, async () => {
    const result = await client2.get("/api/v1/lists");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("get_list", "Buscar lista por ID", {
    id: z13.string().describe("ID da lista")
  }, async (params) => {
    const result = await client2.get(`/api/v1/lists/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("create_list", "Criar uma nova lista", {
    name: z13.string().describe("Nome da lista"),
    description: z13.string().optional().describe("Descricao da lista")
  }, async (params) => {
    const result = await client2.post("/api/v1/lists", params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("update_list", "Atualizar uma lista existente", {
    id: z13.string().describe("ID da lista"),
    name: z13.string().optional().describe("Nome"),
    description: z13.string().optional().describe("Descricao")
  }, async (params) => {
    const { id, ...body } = params;
    const result = await client2.put(`/api/v1/lists/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("delete_list", "Excluir uma lista (irreversivel)", {
    id: z13.string().describe("ID da lista"),
    confirm: z13.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)")
  }, async (params) => {
    const check = requireConfirmation(config2, params.confirm, "delete_list");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client2.delete(`/api/v1/lists/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/products.ts
import { z as z14 } from "zod";
function registerProductsTools(server2, client2, config2) {
  server2.tool("list_products", "Buscar todos os produtos do CRM", {}, async () => {
    const result = await client2.get("/api/v1/products");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("get_product", "Buscar produto por ID", {
    id: z14.string().describe("ID do produto")
  }, async (params) => {
    const result = await client2.get(`/api/v1/products/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("create_product", "Criar um novo produto", {
    name: z14.string().describe("Nome do produto"),
    price: z14.number().describe("Preco do produto"),
    id_sku: z14.string().optional().describe("SKU do produto")
  }, async (params) => {
    const result = await client2.post("/api/v1/products", params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("update_product", "Atualizar um produto existente", {
    id: z14.string().describe("ID do produto"),
    name: z14.string().optional().describe("Nome"),
    price: z14.number().optional().describe("Preco"),
    id_sku: z14.string().optional().describe("SKU")
  }, async (params) => {
    const { id, ...body } = params;
    const result = await client2.put(`/api/v1/products/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("delete_product", "Excluir produto (nao pode se estiver vinculado a negocio)", {
    id: z14.string().describe("ID do produto"),
    confirm: z14.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)")
  }, async (params) => {
    const check = requireConfirmation(config2, params.confirm, "delete_product");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client2.delete(`/api/v1/products/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/loss-reasons.ts
import { z as z15 } from "zod";
function registerLossReasonsTools(server2, client2, config2) {
  server2.tool("list_loss_reasons", "Buscar motivos de perda de negocios", {}, async () => {
    const result = await client2.get("/api/v1/business-loss-reasons");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("get_loss_reason", "Buscar motivo de perda por ID", {
    id: z15.string().describe("ID do motivo de perda")
  }, async (params) => {
    const result = await client2.get(`/api/v1/business-loss-reasons/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("create_loss_reason", "Criar um novo motivo de perda", {
    name: z15.string().describe("Nome do motivo"),
    requiredJustification: z15.boolean().optional().describe("Exigir justificativa ao usar este motivo")
  }, async (params) => {
    const result = await client2.post("/api/v1/business-loss-reasons", params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("update_loss_reason", "Atualizar motivo de perda", {
    id: z15.string().describe("ID do motivo"),
    name: z15.string().optional().describe("Nome"),
    requiredJustification: z15.boolean().optional().describe("Exigir justificativa")
  }, async (params) => {
    const { id, ...body } = params;
    const result = await client2.put(`/api/v1/business-loss-reasons/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("delete_loss_reason", "Excluir motivo de perda (irreversivel)", {
    id: z15.string().describe("ID do motivo"),
    confirm: z15.boolean().optional().describe("Confirmar exclusao (necessario em SAFE_MODE)")
  }, async (params) => {
    const check = requireConfirmation(config2, params.confirm, "delete_loss_reason");
    if (check.blocked) return { content: [{ type: "text", text: check.message }] };
    const result = await client2.delete(`/api/v1/business-loss-reasons/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/attendants.ts
import { z as z16 } from "zod";
function registerAttendantsTools(server2, client2, _config) {
  server2.tool("list_crm_attendants", "Buscar atendentes do CRM", {}, async () => {
    const result = await client2.get("/api/v1/attendants/crm");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("get_crm_attendant", "Buscar atendente do CRM por ID", {
    id: z16.string().describe("ID do atendente")
  }, async (params) => {
    const result = await client2.get(`/api/v1/attendants/crm/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("list_multi_attendants", "Buscar atendentes do multiatendimento", {}, async () => {
    const result = await client2.get("/api/v1/attendants/multi");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("get_multi_attendant", "Buscar atendente do multiatendimento por ID", {
    id: z16.string().describe("ID do atendente")
  }, async (params) => {
    const result = await client2.get(`/api/v1/attendants/multi/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/tools/instances.ts
import { z as z17 } from "zod";
function registerInstancesTools(server2, client2, _config) {
  server2.tool("list_instances", "Buscar instancias de conexao (WhatsApp, Telegram, etc)", {}, async () => {
    const result = await client2.get("/api/v1/instances");
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  server2.tool("get_instance", "Buscar instancia de conexao por ID", {
    id: z17.string().describe("ID da instancia")
  }, async (params) => {
    const result = await client2.get(`/api/v1/instances/${params.id}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
}

// src/index.ts
var config = loadConfig();
var client = new DataCrazyClient(config);
var server = new McpServer({
  name: "mcp-datacrazy",
  version: "1.0.0",
  description: "MCP server para o CRM DataCrazy \u2014 acesso completo a leads, negocios, conversas, atividades e mais."
});
registerLeadsTools(server, client, config);
registerLeadAttachmentsTools(server, client, config);
registerLeadNotesTools(server, client, config);
registerLeadHistoryTools(server, client, config);
registerLeadActivitiesTools(server, client, config);
registerLeadBusinessesTools(server, client, config);
registerBusinessesTools(server, client, config);
registerBusinessActionsTools(server, client, config);
registerActivitiesTools(server, client, config);
registerConversationsTools(server, client, config);
registerPipelinesTools(server, client, config);
registerTagsTools(server, client, config);
registerListsTools(server, client, config);
registerProductsTools(server, client, config);
registerLossReasonsTools(server, client, config);
registerAttendantsTools(server, client, config);
registerInstancesTools(server, client, config);
var transport = new StdioServerTransport();
await server.connect(transport);
