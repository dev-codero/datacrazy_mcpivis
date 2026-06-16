# MCP DataCrazy CRM

Servidor MCP em TypeScript para operar o CRM DataCrazy a partir de clientes como Claude, Cursor, Hermes ou qualquer host compatível com MCP.

O foco deste projeto não é ter pouco arquivo `.ts`; o foco é deixar claro o processo:

1. configurar token e URLs corretas;
2. subir o servidor MCP local via stdio;
3. conectar o cliente MCP;
4. usar as tools para ler/escrever no CRM com segurança;
5. manter scripts auxiliares separados das tools oficiais.

## Resumo rápido

- Nome do pacote/binário: `mcp-datacrazy`
- Transporte deste servidor: MCP via `stdio`
- URL oficial do MCP DataCrazy usada internamente em algumas tools: `https://mcp.g1.datacrazy.io/api/mcp`
- URL REST legada/default: `https://api.g1.datacrazy.io`
- Token obrigatório: `DATACRAZY_API_TOKEN`
- Safe mode default: ligado (`SAFE_MODE=true`)
- n8n sync default: dry-run ligado (`N8N_DRY_RUN=true`)

Importante: este projeto em si não abre uma URL HTTP local. Ele é um servidor MCP de `stdio`. A URL que importa para o DataCrazy é `DATACRAZY_MCP_URL`, usada pelo cliente interno para chamar o MCP oficial do DataCrazy.

## Como instalar

```bash
npm install
cp .env.example .env
```

Edite `.env` e preencha pelo menos:

```bash
DATACRAZY_API_TOKEN=seu_jwt_aqui
```

Defaults já configurados:

```bash
DATACRAZY_API_URL=https://api.g1.datacrazy.io
DATACRAZY_MCP_URL=https://mcp.g1.datacrazy.io/api/mcp
SAFE_MODE=true
N8N_DRY_RUN=true
```

## Como rodar em desenvolvimento

```bash
npm run dev
```

Como o transporte é `stdio`, o processo fica esperando chamadas MCP pelo stdin/stdout. Rodar manualmente no terminal serve mais para ver se as env vars carregam sem erro.

## Como buildar

```bash
npm run build
```

Saída esperada:

```text
dist/index.js
dist/index.d.ts
```

## Como conectar em um cliente MCP

Depois de rodar `npm run build`, configure o cliente MCP para chamar o arquivo gerado via `node`.

Exemplo genérico de configuração MCP:

```json
{
  "mcpServers": {
    "datacrazy": {
      "command": "node",
      "args": ["/Users/artursousa/code/devero/datacrazy_mcpivis/dist/index.js"],
      "env": {
        "DATACRAZY_API_TOKEN": "COLE_O_TOKEN_AQUI",
        "DATACRAZY_API_URL": "https://api.g1.datacrazy.io",
        "DATACRAZY_MCP_URL": "https://mcp.g1.datacrazy.io/api/mcp",
        "SAFE_MODE": "true",
        "N8N_DRY_RUN": "true"
      }
    }
  }
}
```

Se o cliente MCP herdar variáveis do shell ou carregar `.env`, você pode omitir o bloco `env`; mas o jeito mais previsível é declarar ali.

## Variáveis de ambiente

| Variável | Obrigatória | Default | Uso |
|---|---:|---|---|
| `DATACRAZY_API_TOKEN` | sim | nenhum | JWT usado para autenticar no DataCrazy |
| `DATACRAZY_API_URL` | não | `https://api.g1.datacrazy.io` | REST API legada usada por várias tools |
| `DATACRAZY_MCP_URL` | não | `https://mcp.g1.datacrazy.io/api/mcp` | MCP JSON-RPC oficial do DataCrazy |
| `SAFE_MODE` | não | `true` | exige `confirm: true` em operações destrutivas |
| `N8N_WEBHOOK_URL` | não | webhook atual da Converso/n8n | destino das tools `n8n_sync_*` |
| `N8N_DRY_RUN` | não | `true` | impede envio real para n8n quando ligado |

## URLs importantes

### MCP oficial DataCrazy

```text
https://mcp.g1.datacrazy.io/api/mcp
```

Usada pelo arquivo `src/mcp-client.ts` para chamadas JSON-RPC com streaming SSE.

Headers usados:

```text
Authorization: Bearer <DATACRAZY_API_TOKEN>
Content-Type: application/json
Accept: application/json, text/event-stream
```

### REST legada DataCrazy

```text
https://api.g1.datacrazy.io
```

Usada por `src/client.ts`.

Header usado:

```text
access-token: <DATACRAZY_API_TOKEN>
```

### n8n webhook

```text
https://n8m.conversoai.com.br/webhook/3394ed04-1c67-4bae-89ec-ee71f46b6d95
```

Usado pelas tools:

- `n8n_sync_lead_qualificado` → etapa `Orcamento Enviado`
- `n8n_sync_lead_convertido` → etapa `Convertido`

Por padrão, essas tools também ficam em dry-run por causa de `N8N_DRY_RUN=true`.

## Arquitetura

```text
src/index.ts          entrada do servidor MCP local via stdio
src/config.ts         valida env vars e defaults de URL/safe mode/n8n
src/client.ts         cliente REST legado DataCrazy
src/mcp-client.ts     cliente JSON-RPC para o MCP oficial DataCrazy
src/safe-mode.ts      bloqueio de operações destrutivas sem confirm:true
src/tools/*.ts        módulos de tools expostas ao cliente MCP
scripts/*.ts          scripts exploratórios/operacionais, não são API pública
```

Fluxo simplificado:

```text
Cliente MCP (Claude/Cursor/Hermes)
  -> node dist/index.js via stdio
    -> tools locais em src/tools
      -> DataCrazy REST legado ou MCP oficial
      -> opcionalmente n8n webhook
```

## Tools disponíveis

Total atual no código: 64 tools.

### Leads

- `list_leads`
- `get_lead`
- `create_lead`
- `update_lead`
- `delete_lead`
- `list_lead_notes`
- `add_lead_note`
- `update_lead_note`
- `delete_lead_note`
- `get_lead_history`
- `list_lead_businesses`
- `list_lead_attachments`
- `add_lead_attachment`
- `delete_lead_attachment`
- `list_lead_activities`

### Negócios/businesses

- `list_businesses`
- `get_business`
- `create_business`
- `update_business`
- `delete_business`
- `move_business`
- `win_business`
- `lose_business`
- `restore_business`

### Conversas e mensagens

- `list_conversations`
- `get_conversation_messages`
- `send_message`
- `finish_conversation`

### Atividades

- `list_activities`
- `get_activity`
- `create_activity`
- `update_activity`
- `delete_activity`

### Configurações do CRM

- `list_pipelines`
- `get_pipeline`
- `get_pipeline_stages`
- `list_tags`
- `get_tag`
- `create_tag`
- `update_tag`
- `delete_tag`
- `list_lists`
- `get_list`
- `create_list`
- `update_list`
- `delete_list`
- `list_products`
- `get_product`
- `create_product`
- `update_product`
- `delete_product`
- `list_loss_reasons`
- `get_loss_reason`
- `create_loss_reason`
- `update_loss_reason`
- `delete_loss_reason`

### Atendentes e instâncias

- `list_crm_attendants`
- `get_crm_attendant`
- `list_multi_attendants`
- `get_multi_attendant`
- `list_instances`
- `get_instance`

### n8n / planilhas

- `n8n_sync_lead_qualificado`
- `n8n_sync_lead_convertido`

## Safe mode

`SAFE_MODE=true` é o padrão.

Quando ligado, operações destrutivas exigem o argumento:

```json
{ "confirm": true }
```

Use isso principalmente em:

- `delete_*`
- `lose_business`
- `finish_conversation`
- tools n8n quando for envio real

Para desligar globalmente:

```bash
SAFE_MODE=false
```

Só faça isso em ambiente controlado.

## Processo recomendado de uso

1. Sempre começar consultando dados, nunca alterando direto.
2. Para leads/businesses, buscar por telefone/email/nome antes de criar algo novo.
3. Para mover/ganhar/perder negócio, confirmar IDs e etapa/pipeline antes.
4. Para deletes/finalizações/perdas, manter `SAFE_MODE=true` e passar `confirm:true` só quando tiver certeza.
5. Para n8n, testar primeiro com `N8N_DRY_RUN=true`; só depois usar `N8N_DRY_RUN=false`.
6. Rodar `npm run build` antes de apontar um cliente MCP para `dist/index.js`.

## Scripts úteis

Os scripts em `scripts/` são auxiliares de operação/debug. Eles podem mudar conforme a exploração da API.

Exemplos:

```bash
npx tsx scripts/check-env.ts
npx tsx scripts/list-tools.ts
npx tsx scripts/probe-api.ts
npx tsx scripts/test-sync.ts
```

Regra: se for comportamento oficial para o cliente MCP, deve virar tool em `src/tools/`. Se for exploração/debug pontual, fica em `scripts/`.

## Convenções do projeto

- Nome de tool em `snake_case`.
- Descrições das tools em português, porque o uso real é em pt-BR.
- Um arquivo por domínio/recurso dentro de `src/tools/`.
- Não commitar `.env` nem tokens.
- Não tratar `scripts/` como API estável.
- Preferir documentação operacional simples a excesso de abstração.

## Troubleshooting

### Erro: `DATACRAZY_API_TOKEN environment variable is required`

Preencha `.env` ou declare a env var no cliente MCP.

### Cliente MCP não encontra tools

Rode:

```bash
npm run build
```

E confira se o cliente aponta para:

```text
/Users/artursousa/code/devero/datacrazy_mcpivis/dist/index.js
```

### Operação destrutiva bloqueada

Com `SAFE_MODE=true`, passe:

```json
{ "confirm": true }
```

### n8n não enviou nada

Confira `N8N_DRY_RUN`. O default é não enviar:

```bash
N8N_DRY_RUN=false
```

## Estado atual

O projeto já builda com:

```bash
npm run build
```

O próximo foco deve ser manter a documentação e o processo claros, não reduzir artificialmente o número de arquivos TypeScript.
