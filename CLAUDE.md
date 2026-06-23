# MCP DataCrazy CRM Server

## O que este projeto é

Servidor MCP local, em TypeScript, para dar a um agente de IA acesso operacional ao CRM DataCrazy.

O projeto roda via `stdio` e expõe tools para leads, negócios, atividades, conversas, tags, listas, produtos, motivos de perda, atendentes, instâncias e sincronização n8n.

## Objetivo principal

Este repositório deve ser fácil de operar e entender.

Prioridade:

1. deixar claro qual URL usar;
2. deixar claro quais env vars configurar;
3. deixar claro como o MCP é conectado no cliente;
4. documentar o fluxo de segurança antes de writes/destrutivos;
5. manter scripts exploratórios separados das tools oficiais.

Não otimizar por “ter poucos arquivos `.ts`”. O número de arquivos importa menos do que clareza de domínio e processo.

## Stack

- Linguagem: TypeScript
- Runtime: Node.js
- MCP SDK: `@modelcontextprotocol/sdk`
- Transporte do servidor local: `stdio`
- Build: `tsup`
- Config: `.env` via `dotenv`

## URLs oficiais / defaults

### MCP oficial DataCrazy

```text
https://mcp.g1.datacrazy.io/api/mcp
```

Variável:

```text
DATACRAZY_MCP_URL
```

Usada por `src/mcp-client.ts`.

Headers:

```text
Authorization: Bearer <DATACRAZY_API_TOKEN>
Content-Type: application/json
Accept: application/json, text/event-stream
```

### REST legada DataCrazy

```text
https://api.g1.datacrazy.io
```

Variável:

```text
DATACRAZY_API_URL
```

Usada por `src/client.ts`.

Header:

```text
access-token: <DATACRAZY_API_TOKEN>
Authorization: Bearer <DATACRAZY_API_TOKEN>
```

Tokens novos com prefixo `dc_` foram validados na REST usando `Authorization: Bearer`. `DataCrazyClient` envia os dois headers para compatibilidade.

### Webhook n8n

```text
https://n8m.conversoai.com.br/webhook/3394ed04-1c67-4bae-89ec-ee71f46b6d95
```

Variável:

```text
N8N_WEBHOOK_URL
```

Usado pelas tools:

- `n8n_sync_lead_qualificado`
- `n8n_sync_lead_convertido`

## Variáveis de ambiente

| Variável | Obrigatória | Default | Observação |
|---|---:|---|---|
| `DATACRAZY_API_TOKEN` | sim | nenhum | JWT do DataCrazy |
| `DATACRAZY_API_URL` | não | `https://api.g1.datacrazy.io` | REST legado |
| `DATACRAZY_MCP_URL` | não | `https://mcp.g1.datacrazy.io/api/mcp` | MCP JSON-RPC oficial |
| `SAFE_MODE` | não | `true` | bloqueia destrutivos sem `confirm:true` |
| `N8N_WEBHOOK_URL` | não | webhook atual | integração n8n/Google Sheets |
| `N8N_DRY_RUN` | não | `true` | não envia para n8n por padrão |

## Arquitetura

```text
src/index.ts
  Entrada do servidor MCP local. Registra todas as tools e conecta StdioServerTransport.

src/config.ts
  Carrega `.env`, valida DATACRAZY_API_TOKEN e define defaults de URLs/safety/n8n.

src/client.ts
  Cliente HTTP REST legado do DataCrazy.

src/mcp-client.ts
  Cliente JSON-RPC/SSE para o MCP oficial do DataCrazy.

src/safe-mode.ts
  Helper que exige `confirm:true` quando SAFE_MODE está ligado.

src/tools/*.ts
  Tools oficiais expostas para o cliente MCP.

scripts/*.ts
  Scripts operacionais/exploratórios. Não são contrato público do MCP.
```

## Fluxo de execução

```text
Cliente MCP
  -> inicia `node dist/index.js` via stdio
    -> src/index.ts registra tools locais
      -> tool chama REST DataCrazy, MCP oficial DataCrazy ou webhook n8n
        -> resposta volta ao cliente MCP
```

## Configuração MCP recomendada

Depois de rodar `npm run build`, apontar o cliente MCP para o arquivo buildado.

Exemplo genérico:

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

Observação importante: este projeto não expõe uma URL HTTP local. Ele é um servidor MCP via `stdio`. A URL MCP relevante é a URL remota oficial do DataCrazy: `DATACRAZY_MCP_URL`.

## Instalação e comandos

```bash
npm install
cp .env.example .env
npm run build
```

Desenvolvimento:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Scripts auxiliares:

```bash
npx tsx scripts/check-env.ts
npx tsx scripts/list-tools.ts
npx tsx scripts/probe-api.ts
npx tsx scripts/test-sync.ts
```

## Safe mode

`SAFE_MODE=true` é o default e deve continuar assim.

Quando uma tool destrutiva for chamada, exigir:

```json
{ "confirm": true }
```

Exemplos de operações que merecem confirmação:

- `delete_*`
- `lose_business`
- `finish_conversation`
- envios reais para n8n

## n8n sync

Tools:

- `n8n_sync_lead_qualificado`
  - planilha: `NOVA_LUZ_LEAD_QUALIFICADO`
  - etapa: `Orcamento Enviado`

- `n8n_sync_lead_convertido`
  - planilha: `NOVA_LUZ_LEAD_CONVERTIDO`
  - etapa: `Convertido`

Default seguro:

```text
N8N_DRY_RUN=true
```

Para envio real:

```text
N8N_DRY_RUN=false
```

Nunca assumir envio real sem verificar essa env var.

## Convenções de manutenção

- Tools usam `snake_case`.
- Descrições ficam em português.
- Cada domínio/recurso fica em arquivo próprio em `src/tools/`.
- Writes e destrutivos devem respeitar safe mode quando aplicável.
- `.env` nunca deve ser commitado.
- Scripts em `scripts/` são auxiliares; não prometer estabilidade deles para usuários finais.
- Se uma exploração em `scripts/` virar processo recorrente, transformar em tool documentada.

## Mapa de módulos

Cada arquivo expõe **uma única tool** com discriminador `action` (bundling). Motivo: Claude Desktop ativa modo `tool_search` quando o servidor declara muitas tools, escondendo todas atrás de uma busca semântica que não casa bem. Com 18 tools ficamos abaixo desse threshold.

| Arquivo | Tool MCP | Actions |
|---|---|---|
| `src/tools/leads.ts` | `leads` | list, get, create, update, delete |
| `src/tools/lead-notes.ts` | `lead_notes` | list, add, update, delete |
| `src/tools/lead-attachments.ts` | `lead_attachments` | list, add, delete |
| `src/tools/lead-history.ts` | `lead_history` | (operação única) |
| `src/tools/lead-activities.ts` | `lead_activities` | (operação única) |
| `src/tools/lead-businesses.ts` | `lead_businesses` | (operação única) |
| `src/tools/businesses.ts` | `businesses` | list, get, create, update, delete |
| `src/tools/business-actions.ts` | `business_actions` | move, win, lose, restore |
| `src/tools/activities.ts` | `activities` | list, get, create, update, delete |
| `src/tools/conversations.ts` | `conversations` | list, messages, send, finish |
| `src/tools/pipelines.ts` | `pipelines` | list, get, stages |
| `src/tools/tags.ts` | `tags` | list, get, create, update, delete |
| `src/tools/lists.ts` | `lists` | list, get, create, update, delete |
| `src/tools/products.ts` | `products` | list, get, create, update, delete |
| `src/tools/loss-reasons.ts` | `loss_reasons` | list, get, create, update, delete |
| `src/tools/attendants.ts` | `attendants` | list, get (com `scope: crm\|multi`) |
| `src/tools/instances.ts` | `instances` | list, get |
| `src/tools/n8n-sync.ts` | `n8n_sync` | lead_qualificado, lead_convertido |

### Pattern de bundling

```ts
server.tool(
  "<dominio>",                                          // nome curto, snake_case, plural
  "<descricao com sinonimos pt-br pra busca semantica>",
  {
    action: z.enum([...]).describe("..."),              // discriminador
    // união achatada de todos os parametros, todos opcionais,
    // descrição prefixada com [action] pra orientar o LLM
    id: z.string().optional().describe("[get/update/delete] ..."),
    name: z.string().optional().describe("[create/update] ..."),
    confirm: z.boolean().optional().describe("[delete] ..."),
  },
  async (params) => {
    switch (params.action) {
      case "list": { ... }
      case "get": { if (!params.id) throw new Error("action=get requer 'id'"); ... }
      // ...
    }
  }
);
```

Validação de campos obrigatórios é feita em runtime (`if (!params.x) throw`), não no schema. Razão: `discriminatedUnion` do Zod gera `oneOf` no JSON Schema MCP, que clientes lidam mal.

## Regras para agentes trabalhando neste repo

1. Antes de alterar comportamento, ler `README.md`, `CLAUDE.md`, `AGENTS.md`, `src/config.ts` e o arquivo da tool afetada.
2. Não inventar URL nova. Usar os defaults documentados aqui.
3. Não logar nem commitar tokens.
4. Não desligar `SAFE_MODE` ou `N8N_DRY_RUN` sem pedido explícito.
5. Rodar `npm run build` depois de mudanças em TypeScript.
6. Se mudar env vars, atualizar `.env.example`, `README.md`, `CLAUDE.md` e `AGENTS.md`.

## Estado validado

Última verificação local executada nesta organização:

```bash
npm run build
```

Resultado: build TypeScript concluído com sucesso.

## Rate limit do MCP oficial DataCrazy

Medido em 2026-06-23 contra `https://mcp.g1.datacrazy.io/api/mcp` usando burst de `tools/list` (rota protocolar, não toca CRM).

| Carga | Requisições | Resultado | Latência média |
|---|---:|---|---:|
| 10 rps × 30s | 300 | 300/300 `201` | ~80ms |
| 20 rps × 30s | 600 | 600/600 `201` | ~80ms |

Conclusões:

- Teto **maior que 20 rps (≥ 1200 req/min)** para `tools/list` — não foi encontrado o ceiling real.
- Sem `429`, sem `Retry-After`, sem degradação de latência.
- Mesmo comportamento com tokens de planos diferentes — gateway MCP não diferenciou rate-limit por plano nessa rota.
- Não testado em rotas pesadas (ex: `list_leads` paginado) — rate-limit pode morder só em queries de DB.

Quem precisar de número conservador para client-side throttling, usar **≤ 15 rps por token** como margem segura até medir o teto real.
