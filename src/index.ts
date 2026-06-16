#!/usr/bin/env node

// Carrega .env quando existir (não sobrescreve vars já definidas no shell)
import "dotenv/config";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { DataCrazyClient } from "./client.js";
import { McpClient } from "./mcp-client.js";

// Tool modules
import { registerLeadsTools } from "./tools/leads.js";
import { registerLeadAttachmentsTools } from "./tools/lead-attachments.js";
import { registerLeadNotesTools } from "./tools/lead-notes.js";
import { registerLeadHistoryTools } from "./tools/lead-history.js";
import { registerLeadActivitiesTools } from "./tools/lead-activities.js";
import { registerLeadBusinessesTools } from "./tools/lead-businesses.js";
import { registerBusinessesTools } from "./tools/businesses.js";
import { registerBusinessActionsTools } from "./tools/business-actions.js";
import { registerActivitiesTools } from "./tools/activities.js";
import { registerConversationsTools } from "./tools/conversations.js";
import { registerPipelinesTools } from "./tools/pipelines.js";
import { registerTagsTools } from "./tools/tags.js";
import { registerListsTools } from "./tools/lists.js";
import { registerProductsTools } from "./tools/products.js";
import { registerLossReasonsTools } from "./tools/loss-reasons.js";
import { registerAttendantsTools } from "./tools/attendants.js";
import { registerInstancesTools } from "./tools/instances.js";
import { registerN8nSyncTools } from "./tools/n8n-sync.js";

const config = loadConfig();
const client = new DataCrazyClient(config);
const mcp = new McpClient(config);

const server = new McpServer({
  name: "mcp-datacrazy",
  version: "1.0.0",
  description: "MCP server para o CRM DataCrazy — acesso completo a leads, negocios, conversas, atividades e mais.",
});

// Register all tools
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
registerN8nSyncTools(server, mcp, config);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
