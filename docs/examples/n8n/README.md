# Documentação n8n — tools do MCP oficial DataCrazy

Guias passo a passo para chamar cada tool do MCP oficial DataCrazy (`https://mcp.g1.datacrazy.io/api/mcp`) a partir de um node **HTTP Request** no n8n.

Total: **71 tools**, uma por arquivo, organizadas por grupo.

## Índice por grupo

### Leads (`leads`)

- [`lead_add_list`](leads/n8n-adicionar-lead-a-lista-via-mcp.md) — adicionar um lead a uma lista
- [`lead_add_tag`](leads/n8n-adicionar-tag-lead-via-mcp.md) — adicionar tag a um lead
- [`lead_create`](leads/n8n-criar-lead-via-mcp.md) — criar um lead
- [`lead_get`](leads/n8n-consultar-lead-via-mcp.md) — consultar um lead
- [`lead_list`](leads/n8n-listar-leads-via-mcp.md) — listar leads
- [`lead_list_businesses`](leads/n8n-listar-negocios-do-lead-via-mcp.md) — listar negócios de um lead
- [`lead_remove_list`](leads/n8n-remover-lead-de-lista-via-mcp.md) — remover um lead de uma lista
- [`lead_remove_tag`](leads/n8n-remover-tag-lead-via-mcp.md) — remover tag de um lead
- [`lead_set_additional_field`](leads/n8n-definir-campo-adicional-lead-via-mcp.md) — definir campo adicional de um lead
- [`lead_update_address`](leads/n8n-atualizar-endereco-lead-via-mcp.md) — atualizar endereço de um lead
- [`lead_update_attendant`](leads/n8n-atualizar-atendente-lead-via-mcp.md) — atualizar atendente de um lead
- [`lead_update_contacts`](leads/n8n-atualizar-contatos-lead-via-mcp.md) — atualizar contatos de um lead
- [`lead_update_info`](leads/n8n-atualizar-info-lead-via-mcp.md) — atualizar informações de um lead
- [`lead_update_notes`](leads/n8n-atualizar-notas-lead-via-mcp.md) — atualizar notas de um lead

### Negócios (`businesses`)

- [`business_add_product`](businesses/n8n-adicionar-produto-negocio-via-mcp.md) — adicionar produto a um negócio
- [`business_create`](businesses/n8n-criar-negocio-via-mcp.md) — criar um negócio
- [`business_list_by_attendant`](businesses/n8n-listar-negocios-por-atendente-via-mcp.md) — listar negócios por atendente
- [`business_list_by_stage`](businesses/n8n-listar-negocios-por-etapa-via-mcp.md) — listar negócios por etapa
- [`business_lose`](businesses/n8n-marcar-negocio-como-perdido-via-mcp.md) — marcar um negócio como perdido
- [`business_move_stage`](businesses/n8n-mover-negocio-de-etapa-via-mcp.md) — mover um negócio de etapa
- [`business_remove_product`](businesses/n8n-remover-produto-negocio-via-mcp.md) — remover produto de um negócio
- [`business_update_attendant`](businesses/n8n-atualizar-atendente-negocio-via-mcp.md) — atualizar o atendente de um negócio
- [`business_update_total`](businesses/n8n-atualizar-valor-total-negocio-via-mcp.md) — atualizar o valor total de um negócio
- [`business_won`](businesses/n8n-marcar-negocio-como-ganho-via-mcp.md) — marcar um negócio como ganho

### Conversas (`conversations`)

- [`conversation_find_or_create_by_phone`](conversations/n8n-buscar-ou-criar-conversa-por-telefone-via-mcp.md) — buscar ou criar conversa por telefone
- [`conversation_get_by_lead`](conversations/n8n-consultar-conversa-do-lead-via-mcp.md) — consultar a conversa de um lead
- [`conversation_list`](conversations/n8n-listar-conversas-via-mcp.md) — listar conversas
- [`conversation_messages_list`](conversations/n8n-listar-mensagens-da-conversa-via-mcp.md) — listar mensagens de uma conversa
- [`conversation_send_message`](conversations/n8n-enviar-mensagem-lead-via-mcp.md) — enviar mensagem para um lead

### Pipelines (`pipelines`)

- [`pipeline_create`](pipelines/n8n-criar-pipeline-via-mcp.md) — criar um pipeline
- [`pipeline_group_list`](pipelines/n8n-listar-grupos-de-pipeline-via-mcp.md) — listar grupos de pipeline
- [`pipeline_list`](pipelines/n8n-listar-pipelines-via-mcp.md) — listar pipelines
- [`pipeline_stage_list`](pipelines/n8n-listar-etapas-pipeline-via-mcp.md) — listar etapas de um pipeline
- [`pipeline_stages_save`](pipelines/n8n-substituir-etapas-pipeline-via-mcp.md) — substituir as etapas de um pipeline
- [`pipeline_update`](pipelines/n8n-atualizar-pipeline-via-mcp.md) — atualizar um pipeline

### Tags (`tags`)

- [`tag_create`](tags/n8n-criar-tag-via-mcp.md) — criar uma tag
- [`tag_get`](tags/n8n-consultar-tag-via-mcp.md) — consultar uma tag
- [`tag_list`](tags/n8n-listar-tags-via-mcp.md) — listar tags
- [`tag_update`](tags/n8n-atualizar-tag-via-mcp.md) — atualizar uma tag

### Listas (`list`)

- [`list_create`](list/n8n-criar-lista-via-mcp.md) — criar uma lista
- [`list_get`](list/n8n-consultar-lista-via-mcp.md) — consultar uma lista
- [`list_list`](list/n8n-listar-listas-via-mcp.md) — listar listas
- [`list_update`](list/n8n-atualizar-lista-via-mcp.md) — atualizar uma lista

### Produtos (`products`)

- [`product_create`](products/n8n-criar-produto-via-mcp.md) — criar um produto
- [`product_get`](products/n8n-consultar-produto-via-mcp.md) — consultar um produto
- [`product_list`](products/n8n-listar-produtos-via-mcp.md) — listar produtos
- [`product_update`](products/n8n-atualizar-produto-via-mcp.md) — atualizar um produto

### Campos adicionais (`additional_fields`)

- [`additional_field_business_list`](additional_fields/n8n-listar-campos-adicionais-negocio-via-mcp.md) — listar campos adicionais de negócio
- [`additional_field_company_list`](additional_fields/n8n-listar-campos-adicionais-empresa-via-mcp.md) — listar campos adicionais de empresa
- [`additional_field_create`](additional_fields/n8n-criar-campo-adicional-via-mcp.md) — criar um campo adicional
- [`additional_field_get`](additional_fields/n8n-consultar-campo-adicional-via-mcp.md) — consultar um campo adicional
- [`additional_field_lead_list`](additional_fields/n8n-listar-campos-adicionais-lead-via-mcp.md) — listar campos adicionais de lead
- [`additional_field_update`](additional_fields/n8n-atualizar-campo-adicional-via-mcp.md) — atualizar um campo adicional

### Tipos de atividade (`activities`)

- [`activity_type_create`](activities/n8n-criar-tipo-de-atividade-via-mcp.md) — criar um tipo de atividade
- [`activity_type_get`](activities/n8n-consultar-tipo-de-atividade-via-mcp.md) — consultar um tipo de atividade
- [`activity_type_list`](activities/n8n-listar-tipos-de-atividade-via-mcp.md) — listar tipos de atividade
- [`activity_type_update`](activities/n8n-atualizar-tipo-de-atividade-via-mcp.md) — atualizar um tipo de atividade

### Motivos de perda (`loss_reason`)

- [`loss_reason_create`](loss_reason/n8n-criar-motivo-de-perda-via-mcp.md) — criar um motivo de perda
- [`loss_reason_get`](loss_reason/n8n-consultar-motivo-de-perda-via-mcp.md) — consultar um motivo de perda
- [`loss_reason_list`](loss_reason/n8n-listar-motivos-de-perda-via-mcp.md) — listar motivos de perda
- [`loss_reason_update`](loss_reason/n8n-atualizar-motivo-de-perda-via-mcp.md) — atualizar um motivo de perda

### Atendentes (`attendants`)

- [`attendant_get`](attendants/n8n-consultar-atendente-via-mcp.md) — consultar um atendente
- [`attendant_list`](attendants/n8n-listar-atendentes-via-mcp.md) — listar atendentes

### Departamentos (`department`)

- [`department_create`](department/n8n-criar-departamento-via-mcp.md) — criar um departamento
- [`department_get`](department/n8n-consultar-departamento-via-mcp.md) — consultar um departamento
- [`department_list`](department/n8n-listar-departamentos-via-mcp.md) — listar departamentos
- [`department_update`](department/n8n-atualizar-departamento-via-mcp.md) — atualizar um departamento

### Instâncias (`instance`)

- [`instance_get`](instance/n8n-consultar-instancia-via-mcp.md) — consultar uma instância
- [`instance_list`](instance/n8n-listar-instancias-via-mcp.md) — listar instâncias

### Horários de funcionamento (`working_hours`)

- [`working_hour_get`](working_hours/n8n-consultar-horario-de-funcionamento-via-mcp.md) — consultar um horário de funcionamento
- [`working_hour_list`](working_hours/n8n-listar-horarios-de-funcionamento-via-mcp.md) — listar horários de funcionamento

