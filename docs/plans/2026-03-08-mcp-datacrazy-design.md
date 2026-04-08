# MCP DataCrazy CRM — Design Document

## Goal
Build an MCP server that exposes all 63 DataCrazy CRM API endpoints as tools, giving AI full read/write autonomy with configurable safety levels.

## API Reference
- OpenAPI spec: `https://api.datacrazy.io/v1/api/openapi/v1/json`
- Docs: `https://docs.datacrazy.io/`
- Auth: Bearer JWT via `access-token` header
- Base: `https://api.datacrazy.io/v1`

## Stack
- TypeScript, Node.js, MCP SDK (stdio), tsup

## Configuration
| Var | Required | Default | Description |
|-----|----------|---------|-------------|
| DATACRAZY_API_TOKEN | yes | — | JWT token |
| DATACRAZY_API_URL | no | https://api.datacrazy.io/v1 | API base URL |
| SAFE_MODE | no | true | Require confirmation for destructive ops |

## Tools (63 total)

### Leads (15 tools)
- list_leads, get_lead, create_lead, update_lead, delete_lead
- list_lead_attachments, add_lead_attachment, delete_lead_attachment
- list_lead_notes, add_lead_note, update_lead_note, delete_lead_note
- get_lead_history, list_lead_activities, list_lead_businesses

### Businesses (9 tools)
- list_businesses, get_business, create_business, update_business, delete_business
- win_business, lose_business, move_business, restore_business

### Activities (5 tools)
- list_activities, get_activity, create_activity, update_activity, delete_activity

### Conversations (4 tools)
- list_conversations, get_conversation_messages, send_message, finish_conversation

### Pipelines (3 tools)
- list_pipelines, get_pipeline, get_pipeline_stages

### Tags (5 tools)
- list_tags, get_tag, create_tag, update_tag, delete_tag

### Lists (5 tools)
- list_lists, get_list, create_list, update_list, delete_list

### Products (5 tools)
- list_products, get_product, create_product, update_product, delete_product

### Loss Reasons (5 tools)
- list_loss_reasons, get_loss_reason, create_loss_reason, update_loss_reason, delete_loss_reason

### Attendants (4 tools)
- list_crm_attendants, get_crm_attendant, list_multi_attendants, get_multi_attendant

### Instances (2 tools)
- list_instances, get_instance

## Safe Mode
Destructive tools: all delete_*, lose_business, finish_conversation
- SAFE_MODE=true: require `confirm: true` param, otherwise return warning
- SAFE_MODE=false: execute immediately

## Distribution
- npm package: mcp-datacrazy
- GitHub repo
- Usage: `npx mcp-datacrazy`
